/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Weekly Attendance Days Planner / Organizer Component
 */

import React, { useState, useMemo } from 'react';
import { Student, Group, GradeType } from '../types';
import { dbEngine } from '../db';
import { 
  Calendar, Search, Check, Sparkles, Info, HelpCircle, 
  RefreshCw, CheckSquare, Square, Filter, Printer
} from 'lucide-react';

interface WeeklyAttendancePlannerProps {
  students: Student[];
  groups: Group[];
  onRefresh: () => void;
}

const WEEK_DAYS = ['الجمعة', 'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

const parseGroupDays = (dayStr: string): string[] => {
  if (!dayStr) return [];
  return dayStr
    .split(/ و |,|،|and/)
    .map(d => d.trim())
    .filter(Boolean);
};

export default function WeeklyAttendancePlanner({ students, groups, onRefresh }: WeeklyAttendancePlannerProps) {
  const [selectedGrade, setSelectedGrade] = useState<GradeType>('الصف الثالث الإعدادي');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoSaveMsg, setAutoSaveMsg] = useState<{ studentId: string; day: string } | null>(null);

  // Filter approved students for selected grade
  const gradeStudents = students.filter(s => {
    if (s.status !== 'approved') return false;
    if (s.grade !== selectedGrade) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    }
    return true;
  });

  const gradeGroups = groups.filter(g => g.grade === selectedGrade);

  // Calculate attendance count for each day of the week for the selected grade
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    WEEK_DAYS.forEach(day => {
      counts[day] = 0;
    });

    const targetStudents = students.filter(s => s.status === 'approved' && s.grade === selectedGrade);
    targetStudents.forEach(student => {
      const primaryGroup = groups.find(g => g.id === student.groupId);
      const defaultDays = primaryGroup ? parseGroupDays(primaryGroup.day) : [];
      const checkedDays = student.attendanceDays || defaultDays;
      
      checkedDays.forEach(day => {
        if (day in counts) {
          counts[day]++;
        }
      });
    });

    return counts;
  }, [students, groups, selectedGrade]);

  // Toggle a day's attendance for a student
  const handleToggleDay = (student: Student, day: string) => {
    const primaryGroup = groups.find(g => g.id === student.groupId);
    const defaultDays = primaryGroup ? parseGroupDays(primaryGroup.day) : [];
    
    // Get currently saved days, defaulting to primary group's days if none are custom saved
    const currentDays = student.attendanceDays || [...defaultDays];
    
    let newDays: string[];
    if (currentDays.includes(day)) {
      // Remove day
      newDays = currentDays.filter(d => d !== day);
    } else {
      // Add day
      newDays = [...currentDays, day];
    }

    // Save student with custom attendance days
    const updatedStudent: Student = {
      ...student,
      attendanceDays: newDays
    };

    dbEngine.updateStudent(updatedStudent);
    onRefresh();

    // Trigger rapid autosave feedback
    setAutoSaveMsg({ studentId: student.id, day });
    setTimeout(() => {
      setAutoSaveMsg(prev => prev?.studentId === student.id && prev?.day === day ? null : prev);
    }, 1500);
  };

  // Reset a student's days back to their primary group defaults
  const handleResetDays = (student: Student) => {
    const updatedStudent: Student = {
      ...student,
      attendanceDays: undefined // removes the custom array, falling back to group default
    };
    dbEngine.updateStudent(updatedStudent);
    onRefresh();
  };

  // Print attendance planner table for manual work
  const handlePrint = () => {
    const element = document.getElementById('printable-weekly-attendance-planner');
    if (!element) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      window.print();
      return;
    }

    let stylesHtml = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
      stylesHtml += el.outerHTML;
    });

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة مخطط حضور الطلاب</title>
          ${stylesHtml}
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap');
            body {
              background-color: white !important;
              color: #0f172a !important;
              padding: 20px !important;
              font-family: 'Cairo', sans-serif !important;
              direction: rtl !important;
              text-align: right !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 15px !important;
              font-size: 11px !important;
            }
            th, td {
              border: 1px solid #000 !important;
              padding: 8px 10px !important;
              text-align: right !important;
            }
            th {
              background-color: #f8fafc !important;
              font-weight: bold !important;
              color: #1e293b !important;
            }
            td {
              color: #334155 !important;
              font-weight: bold !important;
            }
          </style>
        </head>
        <body class="bg-white">
          <div style="direction: rtl;">
            ${element.innerHTML}
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 100);
              }, 500);
            });
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs text-right font-sans" id="weekly-attendance-planner">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-150 px-2.5 py-0.5 rounded-full font-black animate-pulse">
              ميزة تنظيم الحضور المرن 🔄
            </span>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              منظم ومخطط أيام الحضور الأسبوعية للطلاب
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            خصص حد مخصص لأيام حضور الطالب الأسبوعية. يظهر الطالب تلقائياً في تحضير أي مجموعة توافق أيامه المحددة.
          </p>
        </div>
        
        {/* Help tooltip summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs max-w-sm text-slate-650 space-y-1 self-stretch md:self-auto">
          <div className="flex items-center gap-1 justify-end font-bold text-slate-800">
            <span>دليل الرموز التفاعلية:</span>
            <HelpCircle className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-center gap-1.5 justify-end text-[11px]">
            <span>يوم أساسي للمجموعة (تلقائي)</span>
            <span className="text-amber-500 text-xs">⭐</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end text-[11px]">
            <span>يوم حضور مرن مخصص مضاف</span>
            <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded-md text-[9px] font-extrabold">حضور مرن 🔄</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50/70 border border-slate-200/80 p-4 rounded-xl">
        {/* Grade selection */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value as GradeType)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-white border border-slate-250 hover:border-slate-400 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none cursor-pointer transition text-right text-slate-800 shadow-xs"
          >
            {(['الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي', 'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'] as GradeType[]).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            تصفية بالصف الدراسي:
          </span>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64 md:w-80 sm:mr-auto">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-450" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو كود الطالب المقيد..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-right outline-none transition-all shadow-xs"
          />
        </div>

        {/* Print button */}
        <button
          onClick={handlePrint}
          disabled={gradeStudents.length === 0}
          className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-55 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
          title="طباعة جدول أيام حضور الطلاب الحالي للعمل عليه يدوياً"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة الجدول الحالي 🖨️</span>
        </button>
      </div>

      {/* Weekly Stats Section */}
      <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-3 duration-250">
        <h4 className="text-xs font-black text-slate-700 flex items-center justify-end gap-1.5">
          <Calendar className="w-4 h-4 text-indigo-500" />
          إحصائيات توزيع الحضور اليومي لطلاب {selectedGrade}:
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WEEK_DAYS.map(day => {
            const count = dayCounts[day] || 0;
            return (
              <div 
                key={day} 
                className="bg-white border border-slate-150 p-2.5 rounded-lg text-center shadow-2xs hover:border-indigo-300 transition-all duration-150 flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-[10px] font-bold text-slate-500">{day}</span>
                <span className="text-sm font-black text-slate-800 font-sans">{count}</span>
                <span className="text-[9px] font-bold text-slate-400">طلاب</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Students Weekly Table Roster */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-right border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold">
              <th className="py-3 px-4 font-black">الكود</th>
              <th className="py-3 px-4 font-black">اسم الطالب</th>
              <th className="py-3 px-4 font-black">المجموعة الأساسية</th>
              {WEEK_DAYS.map(day => (
                <th key={day} className="py-3 px-3 text-center font-black min-w-[70px] bg-slate-50 border-r border-slate-150/40">
                  {day}
                </th>
              ))}
              <th className="py-3 px-4 text-center font-black min-w-[90px]">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150/80">
            {gradeStudents.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 italic">
                  {searchQuery 
                    ? 'لا يوجد نتائج مطابقة للبحث في هذا الصف.' 
                    : `لا يوجد طلاب معتمدين حالياً في ${selectedGrade}.`}
                </td>
              </tr>
            ) : (
              gradeStudents.map(student => {
                const primaryGroup = groups.find(g => g.id === student.groupId);
                const defaultDays = primaryGroup ? parseGroupDays(primaryGroup.day) : [];
                const isCustom = student.attendanceDays !== undefined;
                
                // Effective list of days checked
                const checkedDays = student.attendanceDays || defaultDays;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/40 transition-all">
                    {/* Code */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{student.code}</td>
                    
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{student.name}</span>
                        {isCustom && (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-150 text-[8px] px-1.5 py-0.5 rounded-md font-black" title="هذا الطالب يمتلك جدول حضور مرن مخصص">
                            مرن 🔄
                          </span>
                        )}
                        {autoSaveMsg?.studentId === student.id && (
                          <span className="text-[10px] text-emerald-600 font-bold animate-pulse flex items-center gap-0.5">
                            <Check className="w-3.5 h-3.5" />
                            تم الحفظ تلقائياً!
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{student.school || 'عامة'}</p>
                    </td>

                    {/* Primary Group */}
                    <td className="py-3.5 px-4 font-semibold text-slate-650">
                      {primaryGroup ? (
                        <div className="space-y-0.5">
                          <span className="text-slate-800 font-bold">{primaryGroup.name}</span>
                          <span className="text-[10px] text-slate-400 block">أيامها: ({primaryGroup.day})</span>
                        </div>
                      ) : (
                        <span className="text-rose-500 italic">غير مسجل بمجموعة</span>
                      )}
                    </td>

                    {/* Weekday Checkboxes */}
                    {WEEK_DAYS.map(day => {
                      const isChecked = checkedDays.includes(day);
                      const isDefaultDay = defaultDays.includes(day);
                      
                      return (
                        <td 
                          key={day} 
                          className={`py-3 px-3 text-center border-r border-slate-150/40 transition-colors ${
                            isChecked 
                              ? 'bg-indigo-50/20' 
                              : isDefaultDay 
                                ? 'bg-amber-50/10' 
                                : ''
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleDay(student, day)}
                              className={`p-1 rounded-md border transition-all cursor-pointer focus:outline-none ${
                                isChecked
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                  : 'bg-white border-slate-300 text-slate-350 hover:border-slate-450'
                              }`}
                              title={`${student.name} — ${day}`}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            
                            {/* Visual labels indicating primary group defaults vs custom additions */}
                            {isChecked && isDefaultDay && (
                              <span className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5" title="يوم افتراضي للمجموعة الأساسية">
                                <span>أولى</span>
                                <span className="text-[8px]">⭐</span>
                              </span>
                            )}
                            {isChecked && !isDefaultDay && (
                              <span className="text-[9px] text-indigo-700 font-extrabold" title="يوم مضاف مرن">
                                مرن 🔄
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      {isCustom ? (
                        <button
                          type="button"
                          onClick={() => handleResetDays(student)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                          title="إعادة تعيين جدول الطالب إلى أيام مجموعته الأساسية الافتراضية"
                        >
                          إعادة الافتراضي ↩️
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">افتراضي</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Dynamic footer summary */}
      <div className="bg-indigo-50/40 border border-indigo-150/60 p-4 rounded-xl flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 space-y-1">
          <p className="font-extrabold text-indigo-900">كيف تنعكس هذه الإعدادات على التحضير اليومي؟</p>
          <p className="text-[11px] leading-relaxed text-indigo-800">
            عند رصد الحضور اليومي للمجموعة، سيتم عرض جميع الطلاب المقيدين بها، بالإضافة إلى أي طالب آخر تم تحديد نفس يوم الحصة كأحد أيام حضوره الأسبوعية هنا.
            بهذه الطريقة، إذا استأذن طالب في تغيير يوم حصته ليوم آخر، ما عليك سوى تفعيل اليوم البديل له في هذا الجدول، وسيظهر اسمه مباشرة في الحصتين!
          </p>
        </div>
      </div>

      {/* Hidden Printable Template for Weekly Planner */}
      <div className="hidden" id="printable-weekly-attendance-planner">
        <div className="p-6 text-center border-b-2 border-slate-800 font-sans space-y-2" style={{ direction: 'rtl' }}>
          <h2 className="text-2xl font-black text-slate-900" style={{ margin: '0 0 5px 0' }}>مجموعة العلوم الحديثة — الأستاذ محمود أبوذكري</h2>
          <h3 className="text-sm font-bold text-slate-600" style={{ margin: '0 0 15px 0' }}>مخطط وجدول أيام الحضور الأسبوعية للطلاب (للعمل اليدوي والمراجعة)</h3>
          <h1 className="text-md font-black text-indigo-700 bg-slate-50 border border-slate-200 py-2 rounded-xl" style={{ margin: '10px 0', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            الصف الدراسي: {selectedGrade}
          </h1>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '500px', margin: '15px auto 0 auto', fontSize: '11px', fontWeight: 'bold', textAlign: 'right' }}>
            <div>المادة: العلوم والتأسيس العلمي</div>
            <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
            <div>إجمالي عدد طلاب الكشف: {gradeStudents.length} طالب وطالبة</div>
            <div>طريقة الكشف: تلقائي / حضور مرن مخصص</div>
          </div>
        </div>

        <table className="w-full text-right border-collapse text-xs mt-6" style={{ direction: 'rtl', borderCollapse: 'collapse', width: '100%', marginTop: '20px' }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 font-bold">
              <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', width: '40px', backgroundColor: '#f8fafc' }}>م</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', width: '80px', backgroundColor: '#f8fafc' }}>الكود</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', backgroundColor: '#f8fafc' }}>اسم الطالب رباعي</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', width: '120px', backgroundColor: '#f8fafc' }}>المجموعة الأساسية</th>
              {WEEK_DAYS.map(day => (
                <th key={day} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', width: '70px', backgroundColor: '#f8fafc' }}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gradeStudents.length === 0 ? (
              <tr>
                <td colSpan={4 + WEEK_DAYS.length} style={{ border: '1px solid #000', padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                  لا توجد أسماء طلاب مسجلين في هذا الكشف حالياً.
                </td>
              </tr>
            ) : (
              gradeStudents.map((student, idx) => {
                const primaryGroup = groups.find(g => g.id === student.groupId);
                const defaultDays = primaryGroup ? parseGroupDays(primaryGroup.day) : [];
                const checkedDays = student.attendanceDays || defaultDays;

                return (
                  <tr key={student.id}>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>
                      {student.name}
                      {student.attendanceDays !== undefined && ' (مرن 🔄)'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                      {primaryGroup ? primaryGroup.name : 'غير مسجل بمجموعة'}
                    </td>
                    {WEEK_DAYS.map(day => {
                      const isChecked = checkedDays.includes(day);
                      return (
                        <td 
                          key={day} 
                          style={{ 
                            border: '1px solid #000', 
                            padding: '8px', 
                            textAlign: 'center',
                            backgroundColor: isChecked ? '#f1f5f9' : 'transparent',
                            fontSize: '12px'
                          }}
                        >
                          {isChecked ? '☑' : '☐'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="mt-12 pt-6 border-t border-slate-300" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #cbd5e1' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>توقيع المعلم:</span>
            <strong style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#1e293b' }}>الأستاذ محمود أبوذكري</strong>
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>توقيع المنسق الإداري:</span>
            <strong style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#1e293b' }}>..........................................</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
