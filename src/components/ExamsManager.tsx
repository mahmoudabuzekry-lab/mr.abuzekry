/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { dbEngine } from '../db';
import { Student, Exam, ExamScore, GradeType } from '../types';
import { 
  FileText, Award, Calendar, BookOpen, Search, Plus, Trash2, Edit, X, Check,
  TrendingUp, AlertTriangle, Users, BarChart2, Star, MessageCircle, Copy, ShieldAlert, CheckCircle
} from 'lucide-react';

interface ExamsManagerProps {
  students: Student[];
  exams: Exam[];
  examScores: ExamScore[];
  onRefresh: () => void;
}

export default function ExamsManager({ students, exams, examScores, onRefresh }: ExamsManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add' | 'grades-console' | 'rankings'>('list');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  
  const [deletingExam, setDeletingExam] = useState<Exam | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  
  // Create Form State
  const [examForm, setExamForm] = useState({
    title: '',
    grade: 'الصف الثالث الإعدادي' as GradeType,
    date: new Date().toISOString().split('T')[0],
    maxScore: 20
  });

  // Scores state during console entry
  const [scoreEntryBuffer, setScoreEntryBuffer] = useState<Record<string, { score: number; notes: string }>>({});
  const [searchRosterQuery, setSearchRosterQuery] = useState('');

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.title.trim()) return;

    dbEngine.addExam({
      title: examForm.title,
      grade: examForm.grade,
      date: examForm.date,
      maxScore: Number(examForm.maxScore)
    });

    setExamForm({
      title: '',
      grade: 'الصف الثالث الإعدادي',
      date: new Date().toISOString().split('T')[0],
      maxScore: 20
    });
    setActiveSubTab('list');
    onRefresh();
  };

  const confirmDeleteExam = () => {
    if (!deletingExam) return;
    dbEngine.deleteExam(deletingExam.id);
    setDeletingExam(null);
    onRefresh();
  };

  const handleOpenGradesConsole = (examId: string) => {
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;

    setSelectedExamId(examId);
    
    // Seed buffer from existing registered scores
    const buffer: Record<string, { score: number; notes: string }> = {};
    const relevantScores = examScores.filter(s => s.examId === examId);
    
    relevantScores.forEach(score => {
      buffer[score.studentId] = {
        score: score.score,
        notes: score.notes || ''
      };
    });

    setScoreEntryBuffer(buffer);
    setActiveSubTab('grades-console');
  };

  const handleSaveGrades = () => {
    const exam = exams.find(e => e.id === selectedExamId);
    if (!exam) return;

    Object.keys(scoreEntryBuffer).forEach(studentId => {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      const record = scoreEntryBuffer[studentId];
      dbEngine.addExamScore({
        id: `${selectedExamId}_${studentId}`,
        examId: selectedExamId,
        examTitle: exam.title,
        studentId,
        studentName: student.name,
        score: Number(record.score),
        notes: record.notes
      });
    });

    onRefresh();
    setShowSuccessMessage('تم حفظ ورصد درجات السجل بنجاح!');
    setTimeout(() => setShowSuccessMessage(null), 3000);
    setActiveSubTab('list');
  };

  const getAssessmentText = (score: number, maxScore: number) => {
    const pct = (score / maxScore) * 100;
    if (pct >= 90) return { label: 'ممتاز 🌸', color: 'text-emerald-800 bg-emerald-50 border-emerald-100' };
    if (pct >= 75) return { label: 'جيد جداً ⭐', color: 'text-slate-900 bg-slate-100 border-slate-200' };
    if (pct >= 50) return { label: 'متوسط مقبول 👍', color: 'text-slate-700 bg-slate-50 border-slate-200' };
    return { label: 'يحتاج اهتمام ومتابعة ⚠️', color: 'text-red-800 bg-red-50 border-red-100' };
  };

  // Computations for active Exam view
  const activeExam = exams.find(e => e.id === selectedExamId);
  const relevantScores = examScores.filter(s => s.examId === selectedExamId);
  const examStudents = students.filter(s => s.status === 'approved' && activeExam && s.grade === activeExam.grade);

  const averageScore = relevantScores.length > 0 && activeExam
    ? Math.round((relevantScores.reduce((acc, s) => acc + s.score, 0) / relevantScores.length) * 10) / 10
    : 0;

  const successRate = relevantScores.length > 0 && activeExam
    ? Math.round((relevantScores.filter(s => (s.score / activeExam.maxScore) >= 0.5).length / relevantScores.length) * 100)
    : 0;

  const weakStudents = relevantScores.filter(s => activeExam && (s.score / activeExam.maxScore) < 0.5);

  // Rankings Leaderboard computed logic
  const getGroupRankings = () => {
    if (!activeExam) return [];
    return [...relevantScores].sort((a, b) => b.score - a.score);
  };

  // WhatsApp Message Composer for Exam
  const composeWhatsAppExamLink = (studentName: string, score: number, parentPhone: string) => {
    if (!activeExam) return '';
    const pct = (score / activeExam.maxScore) * 100;
    let label = 'ممتاز ومتميز جداً';
    if (pct < 50) label = 'ضعيف ويحتاج اهتمام ومتابعة واجباته بانتظام';
    else if (pct < 75) label = 'جيد ويحتاج مراجعة طفيفة للحفاظ على التفوق';

    const text = `أولياء الأمور الأفاضل، يسر الأستاذ محمود أبوذكري إحاطتكم بنتيجة الطالب/الطالبة *[${studentName}]* في *[${activeExam.title}]* لمادة العلوم.\nالدرجة: *[${score}]* من *[${activeExam.maxScore}]*.\nالتقييم العام: *[${label}]*. نتطلع لدوام الاجتهاد والتميز. الأستاذ محمود أبوذكري.`;
    
    // Clean parent number
    let cleanPhone = parentPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) {
      cleanPhone = `20${cleanPhone}`; // Add Egypt code
    }
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="exams-manager">
      {/* Control Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white rounded-xl border border-slate-200 text-right">
        <div>
          <h3 className="font-bold text-slate-850 text-base">دفتر الاختبارات والدرجات والتقييم الأكاديمي</h3>
          <p className="text-slate-500 text-xs mt-1">تتبع درجات المتعلمين، إصدار لوائح الشرف والترتيب وتحديد المتعثرين لدعمهم العلمي.</p>
        </div>
        <div className="flex space-x-1.5 space-x-reverse mt-3 sm:mt-0">
          <button
            onClick={() => setActiveSubTab('list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'list' 
                ? 'bg-slate-900 text-white' 
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-205'
            }`}
          >
            سجل الاختبارات العامة
          </button>
          <button
            onClick={() => setActiveSubTab('add')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              activeSubTab === 'add' 
                ? 'bg-slate-900 text-white' 
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-205'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            تأسيس اختبار جديد
          </button>
        </div>
      </div>

      {/* SUBTAB 1: EXAMS DIRECTORY */}
      {activeSubTab === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
          {exams.length === 0 ? (
            <div className="bg-white p-12 text-center col-span-3 text-slate-400 font-bold border border-slate-200 rounded-xl">
              لا توجد اختبارات مسجلة حالياً بالمركز. أضف اختباراً جديداً لتبدأ في رصد التقييمات.
            </div>
          ) : (
            exams.map((exam) => {
              const examResultsCount = examScores.filter(s => s.examId === exam.id).length;
              return (
                <div 
                  key={exam.id} 
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-400 p-5 space-y-4 transition-all duration-200"
                >
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-slate-850 text-sm leading-tight">{exam.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">{exam.grade}</p>
                    </div>
                    <span className="text-[9.5px] bg-slate-100 text-slate-800 font-bold px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                      النهاية: {exam.maxScore} درجة
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-500 font-bold font-sans">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-550" />
                      <span>تاريخ الانعقاد: <span className="text-slate-800">{exam.date}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-550" />
                      <span>المرصودة درجاتهم: <span className="text-slate-800">{examResultsCount} طلاب</span></span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between space-x-1.5 space-x-reverse">
                    <button
                      onClick={() => handleOpenGradesConsole(exam.id)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-850 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3 h-3" />
                      رصد الدرجات
                    </button>
                    
                    <button
                      onClick={() => { setSelectedExamId(exam.id); setActiveSubTab('rankings'); }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-850 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Award className="w-3 h-3" />
                      لوحة ترتيب الأوائل
                    </button>

                    <button
                      onClick={() => setDeletingExam(exam)}
                      className="p-1.5 bg-red-50 text-red-655 hover:bg-red-100 hover:text-red-700 border border-red-100 rounded-lg transition cursor-pointer"
                      title="حذف الاختبار"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUBTAB 2: ADD EXAM FORM */}
      {activeSubTab === 'add' && (
        <form onSubmit={handleCreateExam} className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 space-y-5 text-right font-bold text-xs text-slate-700">
          <div>
            <h3 className="font-bold text-slate-850 text-base">تأسيس اختبار علمي جديد</h3>
            <p className="text-slate-500 mt-1 font-medium">تحديد الصف الدراسي والدرجة المحددة للاختبار لبدء الرصد الرقمي.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5">عنوان أو مسمى الاختبار الدراسكي *</label>
              <input
                type="text"
                required
                value={examForm.title}
                onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                placeholder="مثال: اختبار الأسبوع الأول - الذرات والتفاعل الكيميائي"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all"
              />
            </div>

            <div>
              <label className="block mb-1.5">الصف الدراسي المستهدف *</label>
              <select
                required
                value={examForm.grade}
                onChange={(e) => setExamForm({ ...examForm, grade: e.target.value as GradeType })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-404 rounded-lg text-xs text-right outline-none transition-all"
              >
                <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
              </select>
            </div>

            <div>
              <label className="block mb-1.5">تاريخ الاختبار الأكاديمي *</label>
              <input
                type="date"
                required
                value={examForm.date}
                onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-404 rounded-lg text-xs text-right font-mono outline-none transition-all"
              />
            </div>

            <div>
              <label className="block mb-1.5">النهاية العظمى (الدرجة النهائية للاختبار) *</label>
              <input
                type="number"
                min={5}
                max={200}
                required
                value={examForm.maxScore}
                onChange={(e) => setExamForm({ ...examForm, maxScore: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-404 rounded-lg text-xs text-right font-mono outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex justify-start pt-2">
            <button
              type="submit"
              className="px-6 py-2 bg-slate-900 hover:bg-slate-850 font-bold text-white shadow-xs rounded-lg cursor-pointer transition-all"
            >
              تأسيس وحفظ الاختبار بنجاح
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 3: GRADES ENTRY CONSOLE */}
      {activeSubTab === 'grades-console' && activeExam && (
        <div className="space-y-6 text-right">
          {/* Quick Header details */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border-l border-slate-150 pl-4 md:col-span-2">
              <span className="text-[10px] bg-slate-105 bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-0.5 rounded font-bold">لوحة رصد درجات الاختبار العامة</span>
              <h4 className="font-bold text-slate-900 text-base mt-2">{activeExam.title}</h4>
              <p className="text-slate-500 text-xs mt-1">المرحلة: {activeExam.grade} — الدرجة القصوى: {activeExam.maxScore} درجة</p>
            </div>
            
            <div className="self-center">
              <p className="text-xs text-slate-400 font-bold">مجموع طلاب الصف النشطين</p>
              <strong className="text-sm font-bold text-slate-800 font-sans">{examStudents.length} طلاب مسجلين</strong>
            </div>

            <div className="self-center flex space-x-2 space-x-reverse justify-end">
              <button
                onClick={handleSaveGrades}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
              >
                تأكيد وحفظ السجل
              </button>
              <button
                onClick={() => setActiveSubTab('list')}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 cursor-pointer"
              >
                رجوع
              </button>
            </div>
          </div>

          {/* Table list to input scores */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50/75 p-4 border-b border-slate-200 flex justify-between items-center">
              <h5 className="font-bold text-slate-800 text-xs">قائمة المتعلمين لإدخال المقادير المالية والأكاديمية</h5>
              <div className="relative w-64">
                <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم لتسجيل فوري..."
                  value={searchRosterQuery}
                  onChange={(e) => setSearchRosterQuery(e.target.value)}
                  className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right"
                />
              </div>
            </div>

            <div className="overflow-x-auto text-right text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-600 font-bold border-b border-slate-200 text-right">
                    <th className="py-3 px-5">الكود</th>
                    <th className="py-3 px-5">اسم الطالب بالكامل</th>
                    <th className="py-3 px-5">الدرجة المكتسبة (من {activeExam.maxScore})</th>
                    <th className="py-3 px-5">التقييم التلقائي</th>
                    <th className="py-3 px-5">ملاحظات وشهادة الأستاذ بالنتيجة الكلية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {examStudents
                    .filter(s => s.name.includes(searchRosterQuery))
                    .map((s) => {
                      const record = scoreEntryBuffer[s.id] || { score: 0, notes: '' };
                      const assess = getAssessmentText(record.score, activeExam.maxScore);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/30">
                          <td className="py-3.5 px-5 font-mono text-slate-500 font-bold">{s.code}</td>
                          <td className="py-3.5 px-5 font-bold text-slate-900">{s.name}</td>
                          <td className="py-3.5 px-5">
                            <input
                              type="number"
                              min={0}
                              max={activeExam.maxScore}
                              step={0.5}
                              value={record.score}
                              onChange={(e) => {
                                const score = Math.min(activeExam.maxScore, Math.max(0, Number(e.target.value)));
                                setScoreEntryBuffer({
                                  ...scoreEntryBuffer,
                                  [s.id]: { ...record, score }
                                });
                              }}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-center font-mono font-bold text-slate-805"
                            />
                          </td>
                          <td className="py-3.5 px-5">
                            <span className={`px-2.5 py-0.5 rounded border text-[10px] font-bold ${assess.color}`}>
                              {assess.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-5">
                            <input
                              type="text"
                              value={record.notes}
                              onChange={(e) => {
                                setScoreEntryBuffer({
                                  ...scoreEntryBuffer,
                                  [s.id]: { ...record, notes: e.target.value }
                                });
                              }}
                              placeholder="أدخل رسالة تعزيز لتظهر بصفحة ولي الأمر..."
                              className="w-full max-w-xs px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={handleSaveGrades}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-all"
              >
                تأكيد رصد وتحديث سجل درجات الاختبار بالكامل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: LEADERBOARD & STRUGGLING REPORT */}
      {activeSubTab === 'rankings' && activeExam && (
        <div className="space-y-6 text-right">
          {/* Back btn */}
          <div className="flex justify-between items-center text-right">
            <h4 className="font-bold text-slate-900 text-sm">لوحة رصد تفوق والتحصيل العلمي: {activeExam.title}</h4>
            <button
              onClick={() => setActiveSubTab('list')}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-105 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all"
            >
              رجوع لسجل الاختبارات
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Exam Metrics Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 h-fit">
              <h5 className="font-bold text-xs text-slate-800 border-b border-slate-100 pb-3">الملخص الأكاديمي لمجموعات الصف الدراسي</h5>
              
              <div className="space-y-3 font-bold text-xs text-slate-650 text-slate-600">
                <div className="flex justify-between items-center bg-slate-55 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                  <span>المعدل والوسيط الفني</span>
                  <strong className="text-slate-900 font-sans text-sm">{averageScore} / {activeExam.maxScore}</strong>
                </div>

                <div className="flex justify-between items-center bg-emerald-50/75 p-2.5 rounded-lg border border-emerald-100 text-emerald-800">
                  <span>نسبة نجاح واجتياز الدفعة</span>
                  <strong className="font-sans text-sm">{successRate}%</strong>
                </div>

                <div className="flex justify-between items-center bg-red-50/75 p-2.5 rounded-lg border border-red-100 text-red-800">
                  <span>المعسرين دراسياً (دون الـ 50%)</span>
                  <strong className="font-sans text-sm">{weakStudents.length} طلاب تعثروا</strong>
                </div>
              </div>

              {weakStudents.length > 0 && (
                <div className="p-3 bg-red-50 text-red-800 border border-red-100 rounded-lg space-y-1">
                  <div className="font-bold text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    المقصرين بالتحصيل العلمي
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-550 text-slate-500 font-medium">يتوجب معالجة فروقات التحصيل وتكثيف الشرح والواجبات المنزلية الدورية، وضمان مراجعة أولياء الأمور فورا.</p>
                </div>
              )}
            </div>

            {/* LEADERBOARD LIST */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden md:col-span-2">
              <div className="bg-slate-50/75 p-4 border-b border-slate-200 font-bold text-xs text-slate-850">
                لوحة تفوق الشرف: ترتيب الأوائل بمجموعة العلوم
              </div>

              <div className="overflow-x-auto text-right text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/40 text-slate-600 font-bold border-b border-slate-200 text-right">
                      <th className="py-3 px-5">الترتيب</th>
                      <th className="py-3 px-5">اسم الطالب</th>
                      <th className="py-3 px-5">الدرجة المكتسبة</th>
                      <th className="py-3 px-5">لوحة شرف الأستاذ</th>
                      <th className="py-3 px-5 text-left">مراسلة الوالد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relevantScores.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-400">
                          لا توجد درجات مقيدة بعد. يرجى البدء في رصد درجات الفئة أولاً لعرض الأوائل.
                        </td>
                      </tr>
                    ) : (
                      getGroupRankings().map((score, index) => {
                        const studentDetails = students.find(s => s.id === score.studentId);
                        const assess = getAssessmentText(score.score, activeExam.maxScore);

                        return (
                          <tr key={score.id} className={`${index < 3 ? 'bg-amber-50/20' : 'hover:bg-slate-50/20'}`}>
                            <td className="py-3.5 px-5 font-bold font-sans">
                              {index === 0 ? (
                                <span className="inline-flex items-center justify-center bg-amber-500 text-white w-5 h-5 rounded-full text-[10px]">🥇</span>
                              ) : index === 1 ? (
                                <span className="inline-flex items-center justify-center bg-slate-350 text-slate-700 bg-slate-200 w-5 h-5 rounded-full text-[10px]">🥈</span>
                              ) : index === 2 ? (
                                <span className="inline-flex items-center justify-center bg-amber-700 text-white w-5 h-5 rounded-full text-[10px]">🥉</span>
                              ) : (
                                index + 1
                              )}
                            </td>
                            <td className="py-3.5 px-5 font-bold text-slate-900 flex items-center gap-1.5">
                              {score.studentName}
                              {index < 3 && <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="font-bold text-sm text-slate-900 font-sans">{score.score}</span>
                              <span className="text-slate-400 text-[10px]"> / {activeExam.maxScore}</span>
                            </td>
                            <td className="py-3.5 px-5">
                              <span className={`px-2.5 py-0.5 rounded border text-[9.5px] font-bold ${assess.color}`}>
                                {assess.label}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-left">
                              {studentDetails && (
                                <a
                                  href={composeWhatsAppExamLink(studentDetails.name, score.score, studentDetails.parentPhone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 label-shadow text-white rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit inline-flex cursor-pointer transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  إشعار ولي الأمر
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingExam && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 text-red-600">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                تأكيد حذف الاختبار
              </h3>
            </div>

            {/* Modal Content */}
            <div className="text-xs text-slate-600 leading-relaxed font-semibold space-y-2">
              <p className="text-slate-800 text-sm font-bold">
                هل أنت متأكد تماماً من رغبتك في حذف اختبار <span className="text-red-650">"{deletingExam.title}"</span> نهائياً؟
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                سيؤدي هذا الإجراء إلى إزالة الاختبار وسجل درجات جميع الطلاب المقيدين به بالكامل وبشكل نهائي. لا يمكن استرداد البيانات بعد الحذف.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={confirmDeleteExam}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-xs cursor-pointer text-center"
              >
                نعم، احذف الاختبار نهائياً
              </button>
              <button
                type="button"
                onClick={() => setDeletingExam(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg font-bold transition text-xs cursor-pointer text-center"
              >
                إلغاء الأمر
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TOAST SUCCESS MESSAGE */}
      {showSuccessMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-xl flex items-center gap-3 text-right">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{showSuccessMessage}</p>
            </div>
            <button 
              onClick={() => setShowSuccessMessage(null)}
              className="p-1 hover:bg-slate-50 border border-slate-100 rounded text-slate-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
