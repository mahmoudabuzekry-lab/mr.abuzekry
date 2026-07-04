/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Student, Group, Payment, Attendance, Exam, ExamScore, GradeType, doesMonthPrecedeDate, getCurrentArabicMonthName } from '../types';
import * as XLSX from 'xlsx';
import { 
  TrendingUp, Users, Calendar, DollarSign, Award, Download, Printer, Search, 
  FileText, CheckCircle, AlertTriangle, Copy, Percent, ChevronLeft, UserCheck, 
  BookOpen, Star, Frown, Sparkles, HelpCircle, Phone, MapPin, CheckCircle2,
  Trash2, X, MessageSquare, ListTodo
} from 'lucide-react';

interface ReportsManagerProps {
  students: Student[];
  groups: Group[];
  payments: Payment[];
  attendance: Attendance[];
  exams: Exam[];
  examScores: ExamScore[];
  prices: Record<GradeType, number>;
  onRefresh: () => void;
}

export default function ReportsManager({
  students,
  groups,
  payments,
  attendance,
  exams,
  examScores,
  prices,
  onRefresh
}: ReportsManagerProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'financial' | 'attendance' | 'exams' | 'studentCard'>('financial');

  // General Filters
  const [selectedGrade, setSelectedGrade] = useState<'all' | GradeType>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<'all' | string>('all');
  
  // Available Months (Dynamically computed from payments and current month)
  const currentMonth = getCurrentArabicMonthName();
  const availableMonths = useMemo(() => {
    const list = new Set<string>();
    list.add(currentMonth);
    // Add months from payments
    payments.forEach(p => {
      if (p.month) list.add(p.month);
    });
    return Array.from(list);
  }, [payments, currentMonth]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Available Exams based on selected filters
  const filteredExams = useMemo(() => {
    return exams.filter(e => selectedGrade === 'all' || e.grade === selectedGrade);
  }, [exams, selectedGrade]);

  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Update selected exam when list changes
  React.useEffect(() => {
    if (filteredExams.length > 0) {
      // Find if current exam id is still in filtered, if not set first one
      const exists = filteredExams.find(e => e.id === selectedExamId);
      if (!exists) {
        setSelectedExamId(filteredExams[0].id);
      }
    } else {
      setSelectedExamId('');
    }
  }, [filteredExams, selectedExamId]);

  // Individual Student Selector State
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Copy state for clipboard
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Helper: Filter students by selected Grade and Group
  const activeStudents = useMemo(() => {
    return students.filter(s => {
      if (s.status !== 'approved') return false;
      const matchesGrade = selectedGrade === 'all' || s.grade === selectedGrade;
      const matchesGroup = selectedGroupId === 'all' || s.groupId === selectedGroupId;
      return matchesGrade && matchesGroup;
    });
  }, [students, selectedGrade, selectedGroupId]);

  // Helper: Filter groups based on grade selection
  const filteredGroups = useMemo(() => {
    return groups.filter(g => selectedGrade === 'all' || g.grade === selectedGrade);
  }, [groups, selectedGrade]);

  // Handle grade change and reset group
  const handleGradeChange = (grade: 'all' | GradeType) => {
    setSelectedGrade(grade);
    setSelectedGroupId('all');
  };

  // ==========================================
  // 1. FINANCIAL REPORT & DEBTORS ENGINE
  // ==========================================
  const financialStats = useMemo(() => {
    let totalCollected = 0;
    let totalExpected = 0;

    const list = activeStudents.map(student => {
      const studentPayments = payments.filter(p => p.studentId === student.id && p.month === selectedMonth);
      const precedesReg = doesMonthPrecedeDate(selectedMonth, student.createdAt);
      
      // Calculate due amount
      const gradePrice = prices[student.grade] || 0;
      let amountDue = 0;
      if (!precedesReg) {
        if (student.exemptionType === 'full') {
          amountDue = 0;
        } else if (student.exemptionType === 'partial') {
          amountDue = Math.max(0, gradePrice - student.discountAmount);
        } else {
          amountDue = gradePrice;
        }
      }

      const paid = studentPayments.reduce((acc, p) => acc + p.amountPaid, 0);
      const remaining = Math.max(0, amountDue - paid);

      totalCollected += paid;
      totalExpected += amountDue;

      let status: 'fully_paid' | 'partially_paid' | 'not_paid' | 'exempted' = 'not_paid';
      if (precedesReg) {
        status = 'exempted';
      } else if (student.exemptionType === 'full') {
        status = 'exempted';
      } else if (paid >= amountDue && amountDue > 0) {
        status = 'fully_paid';
      } else if (paid > 0 && paid < amountDue) {
        status = 'partially_paid';
      }

      return {
        student,
        amountDue,
        paid,
        remaining,
        status,
        precedesReg
      };
    });

    const outstanding = totalExpected - totalCollected;
    const rate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;

    return {
      list,
      totalCollected,
      totalExpected,
      outstanding,
      rate
    };
  }, [activeStudents, payments, selectedMonth, prices]);

  const handleExportFinancialToExcel = () => {
    const data = financialStats.list.map(item => ({
      'كود الطالب': item.student.code,
      'الاسم': item.student.name,
      'الصف الدراسي': item.student.grade,
      'المجموعة': groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد',
      'تليفون ولي الأمر': item.student.parentPhone,
      'الشهر المالي': selectedMonth,
      'المبلغ المطلوب ج.م': item.amountDue,
      'المسدد ج.م': item.paid,
      'المتبقي ج.م': item.remaining,
      'حالة السداد': 
        item.status === 'fully_paid' ? 'مسدد بالكامل' : 
        item.status === 'partially_paid' ? 'مسدد جزئياً' : 
        item.status === 'exempted' ? 'معفى / غير مطالب' : 'غير مسدد'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير_الاشتراكات');
    XLSX.writeFile(workbook, `التقرير_المالي_العلوم_${selectedMonth.replace(' ', '_')}.xlsx`);
  };

  // ==========================================
  // 2. ATTENDANCE & ABSENCE ENGINE
  // ==========================================
  const attendanceStats = useMemo(() => {
    // Unique dates with records for filters
    const filteredRecords = attendance.filter(a => {
      const student = students.find(s => s.id === a.studentId);
      if (!student || student.status !== 'approved') return false;
      const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade;
      const matchesGroup = selectedGroupId === 'all' || student.groupId === selectedGroupId;
      return matchesGrade && matchesGroup;
    });

    const uniqueDates = Array.from(new Set(filteredRecords.map(r => r.date))).sort();
    
    // Calculate stats per student
    const studentList = activeStudents.map(student => {
      const studentAttendance = attendance.filter(a => a.studentId === student.id);
      
      const total = studentAttendance.length;
      const present = studentAttendance.filter(a => a.status === 'present').length;
      const late = studentAttendance.filter(a => a.status === 'late').length;
      const absent = studentAttendance.filter(a => a.status === 'absent').length;
      const excused = studentAttendance.filter(a => a.status === 'excused').length;

      const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

      return {
        student,
        total,
        present,
        late,
        absent,
        excused,
        rate: attendanceRate
      };
    });

    // High absence students (absent >= 2 times)
    const criticalAbsentees = studentList.filter(s => s.absent >= 2).sort((a, b) => b.absent - a.absent);

    const totalAttendanceEntries = filteredRecords.length;
    const totalPresents = filteredRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    const centerAttendanceRate = totalAttendanceEntries > 0 ? Math.round((totalPresents / totalAttendanceEntries) * 100) : 100;

    return {
      studentList,
      criticalAbsentees,
      centerAttendanceRate,
      uniqueDatesCount: uniqueDates.length,
      totalAttendanceEntries
    };
  }, [activeStudents, attendance, selectedGrade, selectedGroupId, students]);

  const handleExportAttendanceToExcel = () => {
    const data = attendanceStats.studentList.map(item => ({
      'كود الطالب': item.student.code,
      'الاسم': item.student.name,
      'الصف الدراسي': item.student.grade,
      'المجموعة': groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد',
      'تليفون ولي الأمر': item.student.parentPhone,
      'إجمالي حصص الرصد': item.total,
      'مرات الحضور': item.present,
      'مرات التأخير': item.late,
      'مرات الغياب بدون إذن': item.absent,
      'مرات الغياب بإذن': item.excused,
      'نسبة المواظبة %': `${item.rate}%`
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير_الغياب');
    XLSX.writeFile(workbook, `كشف_المواظبة_العلوم_ابو_ذكري.xlsx`);
  };

  // ==========================================
  // 3. ACADEMIC & EXAMS REPORT ENGINE
  // ==========================================
  const selectedExam = useMemo(() => {
    return exams.find(e => e.id === selectedExamId);
  }, [exams, selectedExamId]);

  const examStats = useMemo(() => {
    if (!selectedExam) return null;

    const scores = examScores.filter(s => s.examId === selectedExamId);
    
    // Keep scores only for students currently matches active filters
    const matchedScores = scores.filter(s => {
      const student = activeStudents.find(as => as.id === s.studentId);
      return !!student;
    });

    if (matchedScores.length === 0) {
      return {
        scoresList: [],
        average: 0,
        highest: 0,
        lowest: 0,
        successRate: 0,
        segments: { excellent: 0, veryGood: 0, good: 0, weak: 0 },
        honorRoll: [],
        needsSupport: []
      };
    }

    const max = selectedExam.maxScore;
    const scoresValues = matchedScores.map(s => s.score);
    const sum = scoresValues.reduce((acc, val) => acc + val, 0);
    const average = parseFloat((sum / matchedScores.length).toFixed(1));
    const highest = Math.max(...scoresValues);
    const lowest = Math.min(...scoresValues);

    const successCount = matchedScores.filter(s => s.score >= max * 0.5).length;
    const successRate = Math.round((successCount / matchedScores.length) * 100);

    // Segmentations
    let excellent = 0; // >= 90%
    let veryGood = 0;  // 75% to 89%
    let good = 0;      // 50% to 74%
    let weak = 0;      // < 50%

    matchedScores.forEach(s => {
      const pct = (s.score / max) * 100;
      if (pct >= 90) excellent++;
      else if (pct >= 75) veryGood++;
      else if (pct >= 50) good++;
      else weak++;
    });

    const scoresList = matchedScores.sort((a, b) => b.score - a.score).map((score, index) => {
      const student = activeStudents.find(as => as.id === score.studentId)!;
      return {
        ...score,
        student,
        rank: index + 1
      };
    });

    const honorRoll = scoresList.filter(s => s.score >= max * 0.9);
    const needsSupport = scoresList.filter(s => s.score < max * 0.5);

    return {
      scoresList,
      average,
      highest,
      lowest,
      successRate,
      segments: { excellent, veryGood, good, weak },
      honorRoll,
      needsSupport
    };
  }, [selectedExam, selectedExamId, examScores, activeStudents]);

  const handleExportExamsToExcel = () => {
    if (!selectedExam || !examStats) return;
    const data = examStats.scoresList.map(item => ({
      'الترتيب في الامتحان': item.rank,
      'كود الطالب': item.student.code,
      'الاسم': item.student.name,
      'الصف الدراسي': item.student.grade,
      'المجموعة': groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد',
      'تليفون ولي الأمر': item.student.parentPhone,
      'درجة الطالب': item.score,
      'الدرجة الكبرى': selectedExam.maxScore,
      'النسبة المئوية %': `${Math.round((item.score / selectedExam.maxScore) * 100)}%`,
      'ملاحظات': item.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نتائج_الاختبار');
    XLSX.writeFile(workbook, `درجات_امتحان_${selectedExam.title.replace(/\s+/g, '_')}.xlsx`);
  };

  // ==========================================
  // 4. INDIVIDUAL STUDENT REPORT ENGINE
  // ==========================================
  const studentSuggestions = useMemo(() => {
    if (!studentSearch.trim()) return [];
    return students.filter(s => 
      s.status === 'approved' &&
      (s.name.includes(studentSearch) || s.code.toLowerCase().includes(studentSearch.toLowerCase()))
    ).slice(0, 8);
  }, [students, studentSearch]);

  const individualStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const studentReportData = useMemo(() => {
    if (!individualStudent) return null;

    const sId = individualStudent.id;
    
    // Attendance
    const studentAttendance = attendance.filter(a => a.studentId === sId);
    const attTotal = studentAttendance.length;
    const attPresent = studentAttendance.filter(a => a.status === 'present').length;
    const attLate = studentAttendance.filter(a => a.status === 'late').length;
    const attAbsent = studentAttendance.filter(a => a.status === 'absent').length;
    const attExcused = studentAttendance.filter(a => a.status === 'excused').length;
    const attRate = attTotal > 0 ? Math.round(((attPresent + attLate) / attTotal) * 100) : 100;

    // Exams
    const studentScores = examScores.filter(s => s.studentId === sId);
    const totalExamsCount = studentScores.length;
    const totalPossiblePoints = studentScores.reduce((acc, s) => {
      const ex = exams.find(e => e.id === s.examId);
      return acc + (ex?.maxScore || 100);
    }, 0);
    const totalStudentPoints = studentScores.reduce((acc, s) => acc + s.score, 0);
    const academicPercent = totalPossiblePoints > 0 ? Math.round((totalStudentPoints / totalPossiblePoints) * 100) : 100;

    const examHistory = studentScores.map(score => {
      const ex = exams.find(e => e.id === score.examId)!;
      const allScoresForThisExam = examScores.filter(es => es.examId === score.examId).map(es => es.score);
      const exMax = ex ? ex.maxScore : 100;
      const exAvg = allScoresForThisExam.length > 0 ? parseFloat((allScoresForThisExam.reduce((a,b) => a+b, 0) / allScoresForThisExam.length).toFixed(1)) : 0;
      
      let rank = 1;
      const sortedScores = [...allScoresForThisExam].sort((a,b) => b-a);
      const myRankIndex = sortedScores.indexOf(score.score);
      if (myRankIndex !== -1) rank = myRankIndex + 1;

      return {
        scoreRecord: score,
        exam: ex,
        max: exMax,
        avg: exAvg,
        rank,
        percent: Math.round((score.score / exMax) * 100)
      };
    });

    // Payments
    const studentPayments = payments.filter(p => p.studentId === sId);
    const totalSpent = studentPayments.reduce((acc, p) => acc + p.amountPaid, 0);

    return {
      attendance: {
        total: attTotal,
        present: attPresent,
        late: attLate,
        absent: attAbsent,
        excused: attExcused,
        rate: attRate,
        history: studentAttendance.sort((a, b) => b.date.localeCompare(a.date))
      },
      exams: {
        totalExamsCount,
        percent: academicPercent,
        history: examHistory.sort((a,b) => (b.exam?.date || '').localeCompare(a.exam?.date || ''))
      },
      payments: {
        totalSpent,
        history: studentPayments.sort((a,b) => b.date.localeCompare(a.date))
      }
    };
  }, [individualStudent, attendance, examScores, exams, payments]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs Selector (no-print) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex flex-wrap gap-2 justify-start items-center shadow-xs no-print">
        <button
          onClick={() => setActiveTab('financial')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'financial' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          تقرير سداد الاشتراكات والمديونيات
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'attendance' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          تقرير المواظبة والغياب المتكرر
        </button>

        <button
          onClick={() => setActiveTab('exams')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'exams' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Award className="w-4 h-4" />
          تحليل درجات السنتر والامتحانات
        </button>

        <button
          onClick={() => setActiveTab('studentCard')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'studentCard' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          شهادة الطالب التفصيلية الشاملة
        </button>
      </div>

      {/* Primary Filters Panel (no-print) */}
      {activeTab !== 'studentCard' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm no-print">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">تصفية حسب الصف الدراسي</label>
            <select
              value={selectedGrade}
              onChange={(e) => handleGradeChange(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs outline-none"
            >
              <option value="all">كل الصفوف الدراسية</option>
              <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
              <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
              <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
              <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
              <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
              <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">تصفية حسب المجموعة</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs outline-none"
            >
              <option value="all">كل المجموعات التعليمية</option>
              {filteredGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.grade})</option>
              ))}
            </select>
          </div>

          {activeTab === 'financial' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">الشهر المالي المستهدف</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs outline-none font-bold"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'exams' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">اختر الامتحان المراد تحليله *</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs outline-none"
                disabled={filteredExams.length === 0}
              >
                {filteredExams.length === 0 ? (
                  <option value="">لا يوجد اختبارات مضافة مطابقة</option>
                ) : (
                  filteredExams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title} (الدرجة: {ex.maxScore}) — {ex.date}</option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TAB: FINANCIAL REPORTS DISPLAY                         */}
      {/* ========================================================= */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">إجمالي الإيرادات المتوقعة</p>
                <h4 className="text-xl font-black text-slate-800 mt-1">{financialStats.totalExpected} ج.م</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">عدد المطالبين: {financialStats.list.filter(i => i.amountDue > 0).length} طالب</p>
              </div>
              <div className="bg-slate-50 text-slate-600 p-3 rounded-xl border border-slate-100"><DollarSign className="w-5 h-5 text-blue-600" /></div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">المحصل الفعلي المسدد</p>
                <h4 className="text-xl font-black text-emerald-600 mt-1">{financialStats.totalCollected} ج.م</h4>
                <p className="text-[10px] text-emerald-600 font-bold mt-0.5">نسبة السداد: {financialStats.rate}%</p>
              </div>
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100"><CheckCircle className="w-5 h-5" /></div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">المتبقي (مديونيات معلقة)</p>
                <h4 className="text-xl font-black text-red-600 mt-1">{financialStats.outstanding} ج.م</h4>
                <p className="text-[10px] text-red-500 font-bold mt-0.5">عدد الممتنعين/المتبقي: {financialStats.list.filter(i => i.remaining > 0).length} طالب</p>
              </div>
              <div className="bg-red-50/50 text-red-700 p-3 rounded-xl border border-red-100"><AlertTriangle className="w-5 h-5" /></div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-slate-400 mb-2">مستوى استجابة التحصيل ماليًا</p>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${financialStats.rate >= 80 ? 'bg-emerald-500' : financialStats.rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${financialStats.rate}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2 text-[10px] font-bold text-slate-500">
                <span>{financialStats.rate}% سددوا</span>
                <span>{100 - financialStats.rate}% متبقي</span>
              </div>
            </div>
          </div>

          {/* Table List of Subscription Status */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">تفصيل سداد اشتراك {selectedMonth}</h3>
                <p className="text-xs text-slate-400 font-medium">قائمة تفصيلية توضح المبالغ المستلمة من المتعلمين والمتبقي للتذكير والتحصيل.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportFinancialToExcel}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير كشف Excel
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-blue-200"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة الكشف
                </button>
              </div>
            </div>

            {/* Print Header layout (only visible on print) */}
            <div className="hidden print:block p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
              <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة — الأستاذ محمود أبوذكري</h2>
              <h3 className="text-lg font-bold text-slate-700">تقرير سداد مديونيات واشتراكات الطلاب لشهر: {selectedMonth}</h3>
              <p className="text-xs text-slate-500">تاريخ استخراج التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-4 text-xs font-bold border p-3 rounded-lg bg-slate-50">
                <div>إجمالي المطلوب: {financialStats.totalExpected} ج.م</div>
                <div>إجمالي المسدد: {financialStats.totalCollected} ج.م</div>
                <div>إجمالي المتبقي: {financialStats.outstanding} ج.م</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3.5 px-4">كود الطالب</th>
                    <th className="py-3.5 px-4">اسم الطالب</th>
                    <th className="py-3.5 px-4">الصف الدراسي</th>
                    <th className="py-3.5 px-4">المجموعة</th>
                    <th className="py-3.5 px-4">المطلوب</th>
                    <th className="py-3.5 px-4">المسدد فعلياً</th>
                    <th className="py-3.5 px-4">المتبقي المطلوب</th>
                    <th className="py-3.5 px-4">الحالة للغلق</th>
                    <th className="py-3.5 px-4 no-print">إجراءات التواصل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financialStats.list.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400 italic font-bold">
                        لا يوجد طلاب معتمدين يطابقون خيارات التصفية النشطة حالياً.
                      </td>
                    </tr>
                  ) : (
                    financialStats.list.map(({ student, amountDue, paid, remaining, status, precedesReg }) => {
                      const waText = `السلام عليكم يا فندم، نود تذكيركم باشتراك شهر ${selectedMonth} لمادة العلوم مع الأستاذ محمود أبوذكري للطالب/ة ${student.name}. المبلغ المطلوب: ${amountDue} ج.م المسدد: ${paid} ج.م المتبقي المستحق: ${remaining} ج.م. شاكرين ومقدرين حسن تعاونكم.`;
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-500">{student.code}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{student.name}</td>
                          <td className="py-3 px-4 font-medium text-slate-500">{student.grade}</td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">{amountDue} ج.م</td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700">{paid} ج.م</td>
                          <td className="py-3 px-4 font-mono font-bold text-red-600">
                            {remaining > 0 ? `${remaining} ج.م` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              status === 'fully_paid' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : status === 'partially_paid' 
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : status === 'exempted'
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                              {status === 'fully_paid' ? 'مسدد بالكامل' : status === 'partially_paid' ? 'مسدد جزئي' : status === 'exempted' ? 'معفى' : 'غير مسدد'}
                            </span>
                          </td>
                          <td className="py-3 px-4 no-print">
                            {remaining > 0 ? (
                              <div className="flex gap-1.5 items-center">
                                <a
                                  href={`https://wa.me/${student.parentPhone.startsWith('0') ? '2' + student.parentPhone : student.parentPhone}?text=${encodeURIComponent(waText)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                                  title="تنبيه بالواتساب"
                                >
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  مراسلة ولي الأمر
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(waText, student.id)}
                                  className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="نسخ نص المطالبة المالية"
                                >
                                  {copiedId === student.id ? (
                                    <span className="text-[9px] text-emerald-600 font-bold px-1 bg-emerald-50 rounded">تم!</span>
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-bold italic text-[10px]">خالي من الاستحقاق</span>
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
      )}

      {/* ========================================================= */}
      {/* 2. TAB: ATTENDANCE & ABSENCE REPORT                       */}
      {/* ========================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* General Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">معدل الحضور العام للمركز</p>
                <h4 className="text-xl font-black text-blue-600 mt-1">{attendanceStats.centerAttendanceRate}%</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">عدد الحصص المرصودة: {attendanceStats.uniqueDatesCount} حِصص</p>
              </div>
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border border-blue-100"><Percent className="w-5 h-5 text-blue-600" /></div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between col-span-1 md:col-span-2">
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 mb-1.5">مؤشرات الغياب العام لمجموعات العلوم</p>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">الحضور الفعلي</span>
                    <strong className="text-emerald-600 text-lg font-mono">{attendanceStats.centerAttendanceRate}%</strong>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${attendanceStats.centerAttendanceRate}%` }} />
                  </div>
                  <div className="text-left">
                    <span className="text-xs text-slate-500 block">الغياب المعلق</span>
                    <strong className="text-red-500 text-lg font-mono">{100 - attendanceStats.centerAttendanceRate}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Split lists: Left: Critical absence list. Right: Complete Attendance log */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            
            {/* Critical Absentees list (left) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-1 h-fit no-print">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                    متغيبين مكررين (٢ حصة فأكثر)
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">إنذار استباقي لمنع التراجع الدراسي للطلاب.</p>
                </div>
                <span className="text-[9px] bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                  {attendanceStats.criticalAbsentees.length} إنذار
                </span>
              </div>

              <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto pr-1">
                {attendanceStats.criticalAbsentees.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 italic font-medium">
                    🙌 لا يوجد متعلمين لديهم نسبة غياب حرجة حالياً. التزام رائع!
                  </div>
                ) : (
                  attendanceStats.criticalAbsentees.map(({ student, absent, rate }) => {
                    const waText = `السلام عليكم يا فندم، نود إحاطتكم علماً بأن الطالب/ة ${student.name} قد تغيب عن حصص العلوم مع الأستاذ محمود أبوذكري لعدد (${absent}) حصص بشكل مكرر، ونظراً للأهمية وحرصاً على مصلحته ومستواه نرجو التكرم بالمتابعة وحثه على الحضور. نسبة مواظبته الحالية: ${rate}%. بالتوفيق دائماً.`;
                    return (
                      <div key={student.id} className="py-3.5 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded font-bold font-mono">{student.code}</span>
                            <span className="font-bold text-slate-800 block mt-0.5">{student.name}</span>
                            <span className="text-[10px] text-slate-400">مجموعة: {groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</span>
                          </div>
                          <div className="text-left">
                            <span className="text-red-500 font-black block font-mono">غاب {absent} مرات</span>
                            <span className="text-[10px] text-slate-400 font-bold font-mono">مواظبة: {rate}%</span>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <a
                            href={`https://wa.me/${student.parentPhone.startsWith('0') ? '2' + student.parentPhone : student.parentPhone}?text=${encodeURIComponent(waText)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-md border border-red-200 text-[9px] font-bold text-center flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Phone className="w-3 h-3 text-red-500" />
                            إنذار ولي الأمر بالواتساب
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyText(waText, student.id)}
                            className="p-1 px-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-md border border-slate-200 transition cursor-pointer"
                            title="نسخ الرسالة"
                          >
                            {copiedId === student.id ? (
                              <span className="text-[9px] text-emerald-600 font-bold">نسخ!</span>
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Complete roster list (right) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm lg:col-span-2 overflow-hidden flex flex-col h-fit">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">كشف مواظبة الطلاب العام</h4>
                  <p className="text-xs text-slate-400 font-medium">سجل يضم الحضور والغياب والتأخير المفصل لكل متعلم مع معدل المواظبة الكلي.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportAttendanceToExcel}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تصدير الكشف
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-blue-200"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة الكشف
                  </button>
                </div>
              </div>

              {/* Print Header */}
              <div className="hidden print:block p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة — الأستاذ محمود أبوذكري</h2>
                <h3 className="text-lg font-bold text-slate-700">كشف مواظبة وحضور متعلمين العلوم العام</h3>
                <p className="text-xs text-slate-500">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                <div className="mt-2 text-xs font-bold">عدد الطلاب: {attendanceStats.studentList.length} طالب — نسبة الحضور العام: {attendanceStats.centerAttendanceRate}%</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-3 px-4">كود</th>
                      <th className="py-3 px-4">اسم الطالب</th>
                      <th className="py-3 px-4">الصف</th>
                      <th className="py-3 px-4">رصد</th>
                      <th className="py-3 px-4 text-center">حضور</th>
                      <th className="py-3 px-4 text-center">تأخير</th>
                      <th className="py-3 px-4 text-center">غياب</th>
                      <th className="py-3 px-4 text-center">بإذن</th>
                      <th className="py-3 px-4 text-left">معدل الانضباط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceStats.studentList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-10 text-slate-400 italic">
                          لا يوجد طلاب يطابقون هذه الفئات.
                        </td>
                      </tr>
                    ) : (
                      attendanceStats.studentList.map(({ student, total, present, late, absent, excused, rate }) => (
                        <tr key={student.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-400">{student.code}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-800">{student.name}</td>
                          <td className="py-2.5 px-4 text-slate-500">{student.grade.replace('الصف ', '')}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">{total} حِصص</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-600 bg-emerald-50/20">{present}</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-amber-600">{late}</td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-red-500 bg-red-50/10">{absent}</td>
                          <td className="py-2.5 px-4 text-center font-mono text-slate-400">{excused}</td>
                          <td className="py-2.5 px-4 text-left">
                            <span className={`inline-block font-mono font-black text-xs ${
                              rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-blue-600' : rate >= 50 ? 'text-amber-600' : 'text-red-500'
                            }`}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. TAB: EXAMS ACADEMIC PERFORMANCE ANALYSIS               */}
      {/* ========================================================= */}
      {activeTab === 'exams' && (
        <div className="space-y-6">
          {!selectedExam ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 italic font-bold">
              🚫 لا توجد اختبارات مضافة حالياً لتصفيات الصف المحددة، أو لم يتم اختيار امتحان بعد. يرجى إضافة امتحانات من تبويب رصد الدرجات أولاً.
            </div>
          ) : !examStats || examStats.scoresList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 italic font-bold">
              🤔 لا توجد درجات مرصودة لمتعلمين العلوم في امتحان ({selectedExam.title}) حتى الآن. يرجى إدخال النتائج لتفعيل التقارير.
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* KPIs Exam stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400">متوسط الدرجات العام</p>
                    <h4 className="text-xl font-black text-slate-800 mt-1">{examStats.average} / {selectedExam.maxScore}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">النسبة المكافئة: {Math.round((examStats.average / selectedExam.maxScore) * 100)}%</p>
                  </div>
                  <div className="bg-slate-50 text-slate-600 p-3 rounded-xl border border-slate-100"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400">الدرجة الأعلى بالامتحان</p>
                    <h4 className="text-xl font-black text-emerald-600 mt-1">{examStats.highest} / {selectedExam.maxScore}</h4>
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">الدرجة الأدنى: {examStats.lowest}</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100"><Star className="w-5 h-5 text-amber-500 fill-amber-500" /></div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400">معدل النجاح والعبور (٥٠٪+)</p>
                    <h4 className="text-xl font-black text-indigo-600 mt-1">{examStats.successRate}%</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">عدد الناجحين: {examStats.scoresList.filter(s => s.score >= selectedExam.maxScore * 0.5).length} من {examStats.scoresList.length}</p>
                  </div>
                  <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100"><CheckCircle className="w-5 h-5" /></div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
                  <p className="text-[11px] font-bold text-slate-400 mb-1.5">مستويات توزيع الفئات الأكاديمية</p>
                  <div className="space-y-1.5 text-[9px] font-bold text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>ممتاز (٩٠٪+): {examStats.segments.excellent}</span>
                      <span>ضعيف (أقل من ٥٠٪): {examStats.segments.weak}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(examStats.segments.excellent / examStats.scoresList.length) * 100}%` }} title="ممتاز" />
                      <div className="bg-blue-500 h-full" style={{ width: `${(examStats.segments.veryGood / examStats.scoresList.length) * 100}%` }} title="جيد جداً" />
                      <div className="bg-amber-500 h-full" style={{ width: `${(examStats.segments.good / examStats.scoresList.length) * 100}%` }} title="جيد" />
                      <div className="bg-red-500 h-full" style={{ width: `${(examStats.segments.weak / examStats.scoresList.length) * 100}%` }} title="ضعيف" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Honor Roll & Needs Support */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans no-print">
                {/* Honor Roll */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5">
                  <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                      لوحة الشرف للأوائل والممتازين بالامتحان
                    </h4>
                    <span className="text-[9px] bg-amber-50 text-amber-700 font-black px-2 py-0.5 rounded-full">أعلى من ٩٠٪</span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                    {examStats.honorRoll.length === 0 ? (
                      <p className="text-center py-10 text-slate-400 italic">لا يوجد طلاب حاصلين على تقدير ممتاز في هذا الاختبار.</p>
                    ) : (
                      examStats.honorRoll.map((item, idx) => (
                        <div key={item.id} className="py-2.5 flex justify-between items-center px-1.5 hover:bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <div>
                              <strong className="text-slate-800 font-bold">{item.studentName}</strong>
                              <span className="text-[10px] text-slate-400 block">كود: {item.student.code}</span>
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-emerald-600 font-black text-xs block">{item.score} / {selectedExam.maxScore} درجة</span>
                            <span className="text-[9px] text-slate-400 block font-bold">{Math.round((item.score / selectedExam.maxScore) * 100)}%</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Weak / Needs Attention */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3.5">
                  <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Frown className="w-4.5 h-4.5 text-red-500 shrink-0" />
                      متعلمين يستحقون الرعاية والمتابعة (أقل من ٥٠٪)
                    </h4>
                    <span className="text-[9px] bg-red-50 text-red-700 font-black px-2 py-0.5 rounded-full">تنبيه فوري لولي الأمر</span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs max-h-60 overflow-y-auto">
                    {examStats.needsSupport.length === 0 ? (
                      <p className="text-center py-10 text-slate-400 italic">🙌 نبارك لكم خلو الامتحان من نتائج الضعف الدراسي المطلق.</p>
                    ) : (
                      examStats.needsSupport.map((item) => {
                        const waText = `السلام عليكم يا فندم، نود تذكيركم وحرصاً على مصلحة الأبناء، نود إحاطتكم علماً بأن الطالب/ة ${item.studentName} حصل على درجة ${item.score} من ${selectedExam.maxScore} في امتحان مادة العلوم الأخير (${selectedExam.title}) مع الأستاذ محمود أبوذكري. نأمل من سيادتكم المتابعة والاهتمام لحثه على التعويض والتأسيس الجيد. بالنجاح والتوفيق الدائم.`;
                        return (
                          <div key={item.id} className="py-2.5 flex justify-between items-center px-1.5 hover:bg-slate-50 rounded-lg">
                            <div>
                              <strong className="text-slate-800 font-bold">{item.studentName}</strong>
                              <span className="text-[10px] text-slate-400 block">كود: {item.student.code}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-left font-mono">
                                <span className="text-red-500 font-black text-xs block">{item.score} / {selectedExam.maxScore} درجة</span>
                                <span className="text-[9px] text-slate-400 block font-bold">{Math.round((item.score / selectedExam.maxScore) * 100)}%</span>
                              </div>
                              <a
                                href={`https://wa.me/${item.student.parentPhone.startsWith('0') ? '2' + item.student.parentPhone : item.student.parentPhone}?text=${encodeURIComponent(waText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 px-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[9px] font-bold flex items-center gap-1 transition cursor-pointer"
                                title="إرسال إشعار فوري لولي الأمر بالدرجة الحرجة"
                              >
                                <Phone className="w-3 h-3 text-red-600" />
                                إبلاغ الوالد
                              </a>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Complete Exam results table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">بيان درجات امتحان ({selectedExam.title})</h3>
                    <p className="text-xs text-slate-400 font-medium">قائمة تفصيلية بالدرجات والترتيب العام على مستوى صف مادة العلوم للأستاذ محمود أبوذكري.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportExamsToExcel}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تصدير الدرجات Excel
                    </button>
                    <button
                      onClick={handlePrint}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-blue-200"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة الشهادات
                    </button>
                  </div>
                </div>

                {/* Print Header */}
                <div className="hidden print:block p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                  <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة — الأستاذ محمود أبوذكري</h2>
                  <h3 className="text-lg font-bold text-slate-700">بيان درجات امتحان العلوم: {selectedExam.title} (الدرجة الكبرى: {selectedExam.maxScore})</h3>
                  <p className="text-xs text-slate-500">تاريخ الامتحان: {selectedExam.date} — تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
                  <div className="mt-2 text-xs font-bold">المتوسط العام: {examStats.average} — نسبة النجاح: {examStats.successRate}% — عدد المشتركين: {examStats.scoresList.length} طالب</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-3 px-4 text-center">ترتيب الصف</th>
                        <th className="py-3 px-4">كود الطالب</th>
                        <th className="py-3 px-4">اسم الطالب</th>
                        <th className="py-3 px-4">الصف الدراسي</th>
                        <th className="py-3 px-4">المجموعة</th>
                        <th className="py-3 px-4 text-center">درجة الطالب</th>
                        <th className="py-3 px-4 text-center">الدرجة العظمى</th>
                        <th className="py-3 px-4 text-center">النسبة المئوية</th>
                        <th className="py-3 px-4">التقدير الفني</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {examStats.scoresList.map((item) => {
                        const pct = (item.score / selectedExam.maxScore) * 100;
                        const scoreColor = pct >= 90 ? 'text-emerald-700' : pct >= 75 ? 'text-blue-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600';
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 text-center font-bold">
                              {item.rank <= 3 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px]">
                                  🏆 {item.rank}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-400">{item.rank}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-500">{item.student.code}</td>
                            <td className="py-2.5 px-4 font-bold text-slate-800">{item.studentName}</td>
                            <td className="py-2.5 px-4 text-slate-500">{item.student.grade}</td>
                            <td className="py-2.5 px-4 text-slate-600 font-medium">
                              {groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد'}
                            </td>
                            <td className={`py-2.5 px-4 text-center font-mono font-black ${scoreColor}`}>{item.score}</td>
                            <td className="py-2.5 px-4 text-center font-mono text-slate-400">{selectedExam.maxScore}</td>
                            <td className={`py-2.5 px-4 text-center font-mono font-bold ${scoreColor}`}>{Math.round(pct)}%</td>
                            <td className="py-2.5 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                pct >= 90 ? 'bg-emerald-50 text-emerald-700' :
                                pct >= 75 ? 'bg-blue-50 text-blue-700' :
                                pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {pct >= 90 ? 'ممتاز' : pct >= 75 ? 'جيد جداً' : pct >= 50 ? 'جيد' : 'يحتاج اهتمام'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. TAB: COMPREHENSIVE INDIVIDUAL STUDENT CARD              */}
      {/* ========================================================= */}
      {activeTab === 'studentCard' && (
        <div className="space-y-6">
          {/* Student Selector Search bar (no-print) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 no-print">
            <h3 className="font-bold text-slate-800 text-sm">البحث التفصيلي عن كارت الطالب الفردي</h3>
            <p className="text-xs text-slate-400 font-medium">استعلم عن تفريغ شامل للملف الفردي لأي متعلم مسجل في السنتر (الحضور والغياب، الحسابات، الاختبارات والترتيب الدراسي).</p>
            
            <div className="relative max-w-xl">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <Search className="h-4.5 w-4.5 text-slate-400" />
              </div>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  if (selectedStudentId) setSelectedStudentId('');
                }}
                placeholder="ابحث باسم الطالب أو كود المتعلم (مثال: S-1002)..."
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 rounded-xl text-xs outline-none text-right font-medium"
              />

              {/* Suggestions dropdown */}
              {studentSuggestions.length > 0 && !selectedStudentId && (
                <div className="absolute z-10 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 overflow-hidden">
                  {studentSuggestions.map((st) => (
                    <button
                      key={st.id}
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        setStudentSearch(st.name);
                      }}
                      className="w-full text-right py-2.5 px-4 text-xs hover:bg-slate-50 flex justify-between items-center transition"
                    >
                      <strong className="text-slate-800 font-bold">{st.name}</strong>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-mono font-black px-2 py-0.5 rounded">
                        {st.code} — {st.grade.replace('الصف ', '')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Certificate Performance Card Display */}
          {!individualStudent || !studentReportData ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 italic font-bold">
              🔍 الرجاء كتابة اسم الطالب أو كوده في صندوق البحث واختياره لاستخراج شهادة السجل مخصصة ومصقولة للطباعة.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action bar (no-print) */}
              <div className="flex justify-end gap-2 no-print">
                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  طباعة شهادة الأداء الفردية للطالب
                </button>
              </div>

              {/* Stunning Printable Academic Certificate Card Layout */}
              <div className="bg-white border-4 border-slate-900 rounded-3xl p-6 md:p-10 shadow-lg font-sans relative overflow-hidden text-right leading-relaxed print:border-2 print:shadow-none print:p-8">
                {/* Vintage Frame Corner Lines (Aesthetic) */}
                <div className="absolute top-3 right-3 w-12 h-12 border-t-2 border-r-2 border-slate-900/40 pointer-events-none" />
                <div className="absolute top-3 left-3 w-12 h-12 border-t-2 border-l-2 border-slate-900/40 pointer-events-none" />
                <div className="absolute bottom-3 right-3 w-12 h-12 border-b-2 border-r-2 border-slate-900/40 pointer-events-none" />
                <div className="absolute bottom-3 left-3 w-12 h-12 border-b-2 border-l-2 border-slate-900/40 pointer-events-none" />

                {/* Certificate Header Section */}
                <div className="text-center space-y-2 border-b-2 border-slate-800 pb-5">
                  <span className="text-xs bg-slate-100 text-slate-800 border border-slate-200 font-bold px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-1">
                    شهادة تقييم دراسي واستحقاق علمي
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900">مجموعة العلوم الحديثة للتميز التأسيسي</h2>
                  <h3 className="text-sm md:text-base font-extrabold text-blue-700">تحت إشراف موجه المادة الأستاذ: محمود أبوذكري</h3>
                  <p className="text-[10px] text-slate-400 font-mono">سجل العلوم الأكاديمي الرقمي الموحد</p>
                </div>

                {/* Student Profile Block */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60 mt-6 text-xs leading-relaxed print:bg-white">
                  <div>
                    <span className="text-slate-400 font-bold block">اسم الطالب رباعي</span>
                    <strong className="text-slate-850 font-black text-sm block mt-1">{individualStudent.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">كود المتعلم الفريد</span>
                    <strong className="text-blue-700 font-black text-sm block font-mono mt-1">{individualStudent.code}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">المرحلة والصف الدراسي</span>
                    <strong className="text-slate-800 font-bold block mt-1">{individualStudent.grade}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">المجموعة والتوقيت</span>
                    <strong className="text-slate-800 font-bold block mt-1">
                      {groups.find(g => g.id === individualStudent.groupId)?.name || 'لم يحدد بعد'}
                    </strong>
                  </div>
                </div>

                {/* Performance indicators circles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
                  {/* Attendance percentage indicator */}
                  <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-150 text-center flex flex-col justify-center items-center space-y-1 print:bg-white">
                    <span className="text-xs font-bold text-slate-500">نسبة انضباط الحضور</span>
                    <h3 className={`text-3xl font-black font-mono ${
                      studentReportData.attendance.rate >= 90 ? 'text-emerald-600' : studentReportData.attendance.rate >= 75 ? 'text-blue-600' : 'text-amber-500'
                    }`}>
                      {studentReportData.attendance.rate}%
                    </h3>
                    <p className="text-[10px] text-slate-450">حضر {studentReportData.attendance.present + studentReportData.attendance.late} من إجمالي {studentReportData.attendance.total} حصص</p>
                  </div>

                  {/* Academic performance indicator */}
                  <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-150 text-center flex flex-col justify-center items-center space-y-1 print:bg-white">
                    <span className="text-xs font-bold text-slate-500">معدل التحصيل الدراسي الكلي</span>
                    <h3 className={`text-3xl font-black font-mono ${
                      studentReportData.exams.percent >= 85 ? 'text-indigo-600' : studentReportData.exams.percent >= 50 ? 'text-slate-800' : 'text-red-500'
                    }`}>
                      {studentReportData.exams.percent}%
                    </h3>
                    <p className="text-[10px] text-slate-450">إجمالي {studentReportData.exams.totalExamsCount} اختبار علوم مستهدف</p>
                  </div>

                  {/* Financial status indicator */}
                  <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-150 text-center flex flex-col justify-center items-center space-y-1 print:bg-white">
                    <span className="text-xs font-bold text-slate-500">الحالة المالية الإجمالية</span>
                    <h3 className="text-xl font-extrabold text-slate-800 mt-1">
                      {(() => {
                        const currentMonthDebt = payments.filter(p => p.studentId === individualStudent.id && p.month === getCurrentArabicMonthName());
                        const debtCount = currentMonthDebt.reduce((acc, p) => acc + p.amountPaid, 0);
                        const precedes = doesMonthPrecedeDate(getCurrentArabicMonthName(), individualStudent.createdAt);
                        const owed = precedes ? 0 : (individualStudent.exemptionType === 'full' ? 0 : prices[individualStudent.grade] || 0);
                        if (owed === 0 || debtCount >= owed) {
                          return <span className="text-emerald-700 font-black">منتظم ومغلق ✨</span>;
                        } else {
                          return <span className="text-red-600 font-black">قيد التحصيل ⚠️</span>;
                        }
                      })()}
                    </h3>
                    <p className="text-[10px] text-slate-450">إجمالي المصروفات المدفوعة: {studentReportData.payments.totalSpent} ج.م</p>
                  </div>
                </div>

                {/* Section layout: Attendance History & Exams Records */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  {/* Exams History Logs */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-xs text-slate-800 border-b border-slate-200 pb-2">📊 سجل رصد درجات الاختبارات التفصيلي</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {studentReportData.exams.history.length === 0 ? (
                        <p className="text-center py-8 text-slate-400 italic text-xs">لا توجد درجات اختبارات مرصودة للطالب حتى الآن.</p>
                      ) : (
                        studentReportData.exams.history.map((record) => (
                          <div key={record.scoreRecord.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-150 flex justify-between items-center text-xs print:bg-white">
                            <div className="space-y-0.5">
                              <strong className="text-slate-850 font-bold">{record.exam?.title || 'اختبار علوم مفاجئ'}</strong>
                              <p className="text-[10px] text-slate-400">تاريخ الامتحان: {record.exam?.date || 'غير مسجل'} — ترتيب الصف: {record.rank}</p>
                            </div>
                            <div className="text-left font-mono">
                              <strong className={`font-black ${record.percent >= 90 ? 'text-emerald-600' : record.percent >= 50 ? 'text-blue-600' : 'text-red-500'}`}>
                                {record.scoreRecord.score} / {record.max} درجة
                              </strong>
                              <span className="text-[10px] text-slate-400 block font-bold">متوسط الدفعة: {record.avg}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Attendance History Logs */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-xs text-slate-800 border-b border-slate-200 pb-2">🗓️ كشف رصد حضور الحصص التفصيلي</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
                      {studentReportData.attendance.history.length === 0 ? (
                        <p className="text-center py-8 text-slate-400 italic text-xs">لا يوجد سجلات غياب أو حضور مسجلة للطالب.</p>
                      ) : (
                        studentReportData.attendance.history.map((att) => (
                          <div key={att.id} className="p-2.5 bg-slate-50/50 rounded-xl border border-slate-150 flex justify-between items-center print:bg-white">
                            <div className="space-y-0.5">
                              <strong className="text-slate-700 font-bold font-mono">{att.date}</strong>
                              <p className="text-[10px] text-slate-400">{att.checkInTime ? `تحضير رقمي: ${att.checkInTime}` : 'تحضير يدوي'}</p>
                            </div>
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black ${
                              att.status === 'present' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              att.status === 'absent' ? 'bg-red-50 text-red-700 border border-red-100' :
                              att.status === 'late' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {att.status === 'present' ? 'حاضر بالموعد' : att.status === 'absent' ? 'غائب اليوم' : att.status === 'late' ? 'حاضر متأخر' : 'مستأذن'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Signature Seals (Very Aesthetic and professional on Prints) */}
                <div className="grid grid-cols-2 mt-10 pt-6 border-t border-slate-200 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 font-bold block">ملاحظة موجه مادة العلوم</span>
                    <p className="text-[11px] text-slate-600 italic mt-1 leading-relaxed">
                      "التميز العلمي ليس محطة نصل إليها بل رغبة مستمرة في التعلم واكتشاف قوانين الطبيعة المبدعة. تمنياتنا للطالب بدوام التفوق المرموق."
                    </p>
                  </div>
                  <div className="text-left flex flex-col justify-end items-end">
                    <span className="text-slate-400 font-bold block">ختم واعتماد السنتر</span>
                    <strong className="text-slate-800 font-black mt-2 leading-tight">الأستاذ محمود أبوذكري</strong>
                    <span className="text-[10px] text-slate-450 mt-1">توقيع رقمي مسجل وموثق إلكترونياً</span>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
