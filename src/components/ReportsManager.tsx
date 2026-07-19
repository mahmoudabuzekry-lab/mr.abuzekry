/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { dbEngine } from '../db';
import { Student, Group, Payment, Attendance, Exam, ExamScore, GradeType, doesMonthPrecedeDate, getCurrentArabicMonthName } from '../types';
import * as XLSX from 'xlsx';
import { 
  TrendingUp, Users, Calendar, DollarSign, Award, Download, Printer, Search, 
  FileText, CheckCircle, AlertTriangle, Copy, Percent, ChevronLeft, UserCheck, 
  BookOpen, Star, Frown, Sparkles, HelpCircle, Phone, MapPin, CheckCircle2,
  Trash2, X, MessageSquare, ListTodo
} from 'lucide-react';

const ARABIC_DAYS_MAP: { [key: string]: number } = {
  'الأحد': 0,
  'الاثنين': 1,
  'الثلاثاء': 2,
  'الأربعاء': 3,
  'الخميس': 4,
  'الجمعة': 5,
  'السبت': 6
};

const ARABIC_MONTHS_MAP: { [key: string]: number } = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4,
  'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8,
  'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
};

const getGroupDays = (dayStr: string): string[] => {
  if (!dayStr) return [];
  return dayStr
    .split(/ و |,|،|and/)
    .map(d => d.trim())
    .filter(Boolean);
};

const getGroupSessionsInMonth = (group: Group, monthStr: string) => {
  const parts = monthStr.split(/\s+/).filter(Boolean);
  let month = new Date().getMonth() + 1;
  let year = new Date().getFullYear();
  
  for (const part of parts) {
    for (const [mName, mVal] of Object.entries(ARABIC_MONTHS_MAP)) {
      if (part.includes(mName)) {
        month = mVal;
        break;
      }
    }
    const parsedNum = parseInt(part, 10);
    if (!isNaN(parsedNum) && parsedNum > 1900) {
      year = parsedNum;
    }
  }

  const daysOfGroup = getGroupDays(group.day);
  const dayIndices = daysOfGroup.map(d => ARABIC_DAYS_MAP[d]).filter(idx => idx !== undefined);

  if (dayIndices.length === 0) {
    return Array.from({ length: 6 }).map((_, i) => ({
      label: `حصة ${i + 1}`,
      dateStr: `حصة ${i + 1}`
    }));
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const sessions: { label: string; dateStr: string }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();
    if (dayIndices.includes(dayOfWeek)) {
      const dayName = Object.keys(ARABIC_DAYS_MAP).find(k => ARABIC_DAYS_MAP[k] === dayOfWeek) || '';
      sessions.push({
        label: `${dayName} ${d}/${month}`,
        dateStr: `${d}/${month}`
      });
    }
  }

  if (sessions.length === 0) {
    return Array.from({ length: 6 }).map((_, i) => ({
      label: `حصة ${i + 1}`,
      dateStr: `حصة ${i + 1}`
    }));
  }

  return sessions;
};

const getAttendanceHeaders = (groupId: string, grade: string, monthStr: string, groups: Group[]) => {
  if (groupId !== 'all') {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      return getGroupSessionsInMonth(group, monthStr);
    }
  } else if (grade !== 'all') {
    const gradeGroups = groups.filter(g => g.grade === grade);
    if (gradeGroups.length > 0) {
      return getGroupSessionsInMonth(gradeGroups[0], monthStr);
    }
  }
  
  return Array.from({ length: 8 }).map((_, i) => ({
    label: `حصة ${i + 1}`,
    dateStr: `حصة ${i + 1}`
  }));
};

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
  const [activeTab, setActiveTab] = useState<'financial' | 'revenues' | 'attendance' | 'exams' | 'studentCard' | 'revisionSheets' | 'siblings'>('financial');
  const [rosterType, setRosterType] = useState<'revision' | 'attendance' | 'collection'>('revision');

  // Revenues filter state
  const [revenueViewMode, setRevenueViewMode] = useState<'daily' | 'monthly'>('daily');
  const [revenueDate, setRevenueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [revenueMonth, setRevenueMonth] = useState<string>(getCurrentArabicMonthName());
  const [revenueSearchQuery, setRevenueSearchQuery] = useState<string>('');
  const [revenueGradeFilter, setRevenueGradeFilter] = useState<'all' | GradeType>('all');
  const [revenueMethodFilter, setRevenueMethodFilter] = useState<string>('all');

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
      const matchesGroup = selectedGroupId === 'all' || s.groupId === selectedGroupId || (s.alternativeGroupIds && s.alternativeGroupIds.includes(selectedGroupId));
      return matchesGrade && matchesGroup;
    });
  }, [students, selectedGrade, selectedGroupId]);

  // Helper: Calculate dynamic attendance headers
  const activeHeaders = useMemo(() => {
    return getAttendanceHeaders(selectedGroupId, selectedGrade, selectedMonth, groups);
  }, [selectedGroupId, selectedGrade, selectedMonth, groups]);

  // Helper: Filter groups based on grade selection
  const filteredGroups = useMemo(() => {
    return groups.filter(g => selectedGrade === 'all' || g.grade === selectedGrade);
  }, [groups, selectedGrade]);

  // Group approved students by grade for quick overview & bulk grade printing
  const studentsByGrade = useMemo(() => {
    const map: Record<GradeType, Student[]> = {
      'الصف الرابع الابتدائي': [],
      'الصف الخامس الابتدائي': [],
      'الصف السادس الابتدائي': [],
      'الصف الأول الإعدادي': [],
      'الصف الثاني الإعدادي': [],
      'الصف الثالث الإعدادي': []
    };
    students.forEach(s => {
      if (s.status === 'approved' && s.grade in map) {
        map[s.grade].push(s);
      }
    });
    return map;
  }, [students]);

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
      
      // Calculate due amount using dbEngine
      const amountDue = dbEngine.calculateStudentDue(student, selectedMonth);

      const paid = studentPayments.reduce((acc, p) => acc + p.amountPaid, 0);
      const remaining = Math.max(0, amountDue - paid);

      totalCollected += paid;
      totalExpected += amountDue;

      let status: 'fully_paid' | 'partially_paid' | 'not_paid' | 'exempted' = 'not_paid';
      if (amountDue === 0) {
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

  const handleExportRosterToExcel = (gradeName: string, list: Student[]) => {
    let data: any[] = [];
    let sheetName = '';
    let fileName = '';

    if (rosterType === 'revision') {
      data = list.map((s, index) => ({
        'م': index + 1,
        'كود الطالب': s.code,
        'الاسم الكامل': s.name,
        'الصف الدراسي': s.grade,
        'المجموعة': groups.find(g => g.id === s.groupId)?.name || 'غير محدد',
        'تليفون الطالب': s.phone || '—',
        'تليفون ولي الأمر': s.parentPhone,
        'المدرسة': s.school || '—',
        'تعديل البيانات (يدوي)': '',
        'تأكيد الحجز والتوقيع (يدوي)': ''
      }));
      sheetName = 'مراجعة وتأكيد البيانات';
      fileName = `كشف_مراجعة_${gradeName.replace(/\s+/g, '_')}`;
    } else if (rosterType === 'attendance') {
      data = list.map((s, index) => ({
        'م': index + 1,
        'كود الطالب': s.code,
        'الاسم الكامل': s.name,
        'المجموعة': groups.find(g => g.id === s.groupId)?.name || 'غير محدد',
        'تليفون ولي الأمر': s.parentPhone,
        'حصة 1': '',
        'حصة 2': '',
        'حصة 3': '',
        'حصة 4': '',
        'حصة 5': '',
        'حصة 6': '',
        'ملاحظات وسلوك الطالب': ''
      }));
      sheetName = 'حضور وغياب يدوي';
      fileName = `كشف_حضور_${gradeName.replace(/\s+/g, '_')}`;
    } else if (rosterType === 'collection') {
      data = list.map((s, index) => ({
        'م': index + 1,
        'كود الطالب': s.code,
        'الاسم الكامل': s.name,
        'المجموعة': groups.find(g => g.id === s.groupId)?.name || 'غير محدد',
        'تليفون ولي الأمر': s.parentPhone,
        'الشهر المستحق': currentMonth,
        'القيمة المسددة (جنيه)': '',
        'رقم الإيصال الورقي': '',
        'توقيع المحصل والتاريخ': ''
      }));
      sheetName = 'تحصيل اشتراكات يدوي';
      fileName = `كشف_تحصيل_${gradeName.replace(/\s+/g, '_')}`;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  // ==========================================
  // 1.5 REVENUE REVIEW & INCOME REPORT ENGINE
  // ==========================================
  const revenueStats = useMemo(() => {
    const isDaily = revenueViewMode === 'daily';
    
    const filteredPayments = payments.filter(p => {
      // 1. Filter by Date or Month
      if (isDaily) {
        if (p.date !== revenueDate) return false;
      } else {
        if (p.month !== revenueMonth) return false;
      }
      
      // 2. Filter by Search Query
      if (revenueSearchQuery.trim() !== '') {
        const query = revenueSearchQuery.toLowerCase();
        const student = students.find(s => s.id === p.studentId);
        const matchesName = p.studentName.toLowerCase().includes(query);
        const matchesCode = student?.code.toLowerCase().includes(query) || false;
        if (!matchesName && !matchesCode) return false;
      }
      
      // 3. Filter by Grade
      if (revenueGradeFilter !== 'all' && p.grade !== revenueGradeFilter) return false;
      
      // 4. Filter by Payment Method
      if (revenueMethodFilter !== 'all' && p.paymentMethod !== revenueMethodFilter) return false;
      
      return true;
    });

    let totalCollected = 0;
    let cashSum = 0;
    let cashCount = 0;
    let vodafoneSum = 0;
    let vodafoneCount = 0;
    let visaSum = 0;
    let visaCount = 0;
    let otherSum = 0;
    let otherCount = 0;

    filteredPayments.forEach(p => {
      totalCollected += p.amountPaid;
      if (p.paymentMethod === 'نقدي') {
        cashSum += p.amountPaid;
        cashCount++;
      } else if (p.paymentMethod === 'فودافون كاش') {
        vodafoneSum += p.amountPaid;
        vodafoneCount++;
      } else if (p.paymentMethod === 'فيزا') {
        visaSum += p.amountPaid;
        visaCount++;
      } else {
        otherSum += p.amountPaid;
        otherCount++;
      }
    });

    const averagePayment = filteredPayments.length > 0 ? Math.round(totalCollected / filteredPayments.length) : 0;

    // Daily distribution map for monthly breakdown
    const dailyBreakdownMap: Record<string, number> = {};
    filteredPayments.forEach(p => {
      dailyBreakdownMap[p.date] = (dailyBreakdownMap[p.date] || 0) + p.amountPaid;
    });

    const sortedDays = Object.entries(dailyBreakdownMap)
      .map(([dayDate, sum]) => ({ date: dayDate, sum }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      list: filteredPayments,
      totalCollected,
      cashSum,
      cashCount,
      vodafoneSum,
      vodafoneCount,
      visaSum,
      visaCount,
      otherSum,
      otherCount,
      averagePayment,
      sortedDays
    };
  }, [payments, revenueViewMode, revenueDate, revenueMonth, revenueSearchQuery, revenueGradeFilter, revenueMethodFilter, students]);

  const handleExportRevenuesToExcel = () => {
    const isDaily = revenueViewMode === 'daily';
    const data = revenueStats.list.map(item => {
      const student = students.find(s => s.id === item.studentId);
      return {
        'كود الطالب': student?.code || '—',
        'اسم الطالب': item.studentName,
        'الصف الدراسي': item.grade,
        'تاريخ التحصيل': item.date,
        'المبلغ المحصل ج.م': item.amountPaid,
        'طريقة التحصيل': item.paymentMethod,
        'ملاحظات': item.notes || '—'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isDaily ? 'الإيرادات اليومية' : 'الإيرادات الشهرية');
    XLSX.writeFile(workbook, isDaily ? `إيرادات_يوم_${revenueDate}.xlsx` : `إيرادات_شهر_${revenueMonth.replace(' ', '_')}.xlsx`);
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
      const matchesGroup = selectedGroupId === 'all' || student.groupId === selectedGroupId || (student.alternativeGroupIds && student.alternativeGroupIds.includes(selectedGroupId));
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

  // 4.5 SIBLING DETECTION & REPORT ENGINE
  const siblingData = useMemo(() => {
    const approvedStudents = students.filter(s => s.status === 'approved');
    
    // Group approved students by parent phone to find siblings
    const phoneGroups: Record<string, Student[]> = {};
    approvedStudents.forEach(s => {
      if (!s.parentPhone) return;
      const cleanPhone = s.parentPhone.trim().replace(/\D/g, '');
      if (cleanPhone.length >= 7) {
        if (!phoneGroups[cleanPhone]) {
          phoneGroups[cleanPhone] = [];
        }
        phoneGroups[cleanPhone].push(s);
      }
    });

    // Filter to families that actually have more than 1 student
    const siblingFamilies = Object.values(phoneGroups).filter(group => group.length > 1);

    // Flat list of students who have siblings in the system
    const studentsWithSiblings = approvedStudents.filter(s => {
      if (!s.parentPhone) return false;
      const cleanPhone = s.parentPhone.trim().replace(/\D/g, '');
      return cleanPhone.length >= 7 && (phoneGroups[cleanPhone]?.length || 0) > 1;
    });

    // Grouping these students with siblings by their class/grade
    const studentsWithSiblingsByGrade: Record<GradeType, Array<{ student: Student; siblings: Student[] }>> = {
      'الصف الرابع الابتدائي': [],
      'الصف الخامس الابتدائي': [],
      'الصف السادس الابتدائي': [],
      'الصف الأول الإعدادي': [],
      'الصف الثاني الإعدادي': [],
      'الصف الثالث الإعدادي': []
    };

    studentsWithSiblings.forEach(student => {
      const cleanPhone = student.parentPhone.trim().replace(/\D/g, '');
      const family = phoneGroups[cleanPhone] || [];
      const siblingsList = family.filter(s => s.id !== student.id);
      
      if (student.grade in studentsWithSiblingsByGrade) {
        studentsWithSiblingsByGrade[student.grade].push({
          student,
          siblings: siblingsList
        });
      }
    });

    return {
      siblingFamilies,
      studentsWithSiblings,
      studentsWithSiblingsByGrade,
      phoneGroups
    };
  }, [students]);

  const handleExportSiblingsToExcel = (gradeName: string, list: Array<{ student: Student; siblings: Student[] }>) => {
    const data = list.map((item, index) => ({
      'م': index + 1,
      'كود الطالب': item.student.code,
      'اسم الطالب': item.student.name,
      'الصف الدراسي': item.student.grade,
      'المجموعة': groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد',
      'تليفون ولي الأمر': item.student.parentPhone,
      'عدد الإخوة بالسنتر': item.siblings.length,
      'بيانات الإخوة بالسنتر': item.siblings.map(s => `${s.name} (${s.grade} - كود: ${s.code})`).join(' | ')
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير الإخوة');
    XLSX.writeFile(workbook, `كشف_الطلاب_الإخوة_${gradeName.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePrint = (elementId?: string) => {
    if (elementId) {
      const element = document.getElementById(elementId);
      if (!element) {
        window.print();
        return;
      }

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
            <title>طباعة التقرير</title>
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
              .no-print {
                display: none !important;
              }
              .hidden.print\\:block {
                display: block !important;
              }
              .print\\:block {
                display: block !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                margin-top: 15px !important;
                font-size: 11px !important;
              }
              th, td {
                border: 1px solid #cbd5e1 !important;
                padding: 10px 12px !important;
                text-align: right !important;
              }
              th {
                background-color: #f8fafc !important;
                font-weight: bold !important;
                color: #1e293b !important;
              }
              td {
                color: #334155 !important;
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
    } else {
      window.print();
    }
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
          onClick={() => setActiveTab('revenues')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'revenues' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          مراجعة وتفصيل الإيرادات (يومي/شهري)
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

        <button
          onClick={() => setActiveTab('revisionSheets')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'revisionSheets' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Printer className="w-4 h-4" />
          كشوف مراجعة البيانات وتأكيد الحجز
        </button>

        <button
          onClick={() => setActiveTab('siblings')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'siblings' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          تقرير كشف الإخوة بكل صف
        </button>
      </div>

      {/* Primary Filters Panel (no-print) */}
      {activeTab !== 'studentCard' && activeTab !== 'revenues' && (
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

          {(activeTab === 'financial' || activeTab === 'revisionSheets') && (
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">{activeTab === 'revisionSheets' ? 'الشهر المستهدف لتسجيل الحضور' : 'الشهر المالي المستهدف'}</label>
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
          <div id="printable-financial-report" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
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
                  onClick={() => handlePrint('printable-financial-report')}
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
      {/* 1.5. TAB: REVENUES REVIEW REPORT                          */}
      {/* ========================================================= */}
      {activeTab === 'revenues' && (
        <div className="space-y-6">
          {/* Header & Mode Switcher */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs no-print">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  تقرير مراجعة وتفصيل الإيرادات المحصلة
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  تتبع وفحص التدفقات النقدية والتحصيلات على أساس يومي وتاريخ محدد أو بشكل شهري تراكمي.
                </p>
              </div>

              {/* Toggle Mode */}
              <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto self-stretch md:self-auto">
                <button
                  type="button"
                  onClick={() => setRevenueViewMode('daily')}
                  className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    revenueViewMode === 'daily'
                      ? 'bg-white text-indigo-750 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  التحصيل اليومي (يوم محدد)
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueViewMode('monthly')}
                  className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    revenueViewMode === 'monthly'
                      ? 'bg-white text-indigo-750 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  التقرير الشهري العام
                </button>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
              {/* Date / Month Picker depending on view mode */}
              <div className="sm:col-span-2">
                {revenueViewMode === 'daily' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5">اختر التاريخ المحدد للمراجعة *</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={revenueDate}
                        onChange={(e) => setRevenueDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none text-right font-mono font-bold"
                      />
                      {revenueDate && (
                        <span className="absolute left-3 top-2.5 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                          {(() => {
                            const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            const d = new Date(revenueDate);
                            return isNaN(d.getTime()) ? '' : days[d.getDay()];
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5">اختر الشهر المالي المطلوب *</label>
                    <select
                      value={revenueMonth}
                      onChange={(e) => setRevenueMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none font-bold text-right"
                    >
                      {availableMonths.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Search filter within selected revenues */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">بحث بالاسم أو الكود</label>
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="اسم الطالب أو الكود..."
                    value={revenueSearchQuery}
                    onChange={(e) => setRevenueSearchQuery(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none text-right"
                  />
                </div>
              </div>

              {/* Class Grade filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">الصف الدراسي</label>
                <select
                  value={revenueGradeFilter}
                  onChange={(e) => setRevenueGradeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none text-right font-semibold"
                >
                  <option value="all">كل الصفوف</option>
                  <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                  <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                  <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                  <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                  <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                  <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                </select>
              </div>

              {/* Payment Method filter */}
              <div className="sm:col-start-4">
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">طريقة التحصيل</label>
                <select
                  value={revenueMethodFilter}
                  onChange={(e) => setRevenueMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs outline-none text-right font-semibold"
                >
                  <option value="all">كل طرق التحصيل</option>
                  <option value="نقدي">نقدي (في السنتر)</option>
                  <option value="فودافون كاش">فودافون كاش (Vodafone Cash)</option>
                  <option value="فيزا">بطاقة فيزا (Visa/Mastercard)</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
            </div>
          </div>

          {/* Revenue KPIs Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print animate-in fade-in duration-350">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">إجمالي المبالغ المحصلة</p>
                <h4 className="text-xl font-black text-emerald-600 mt-1">{revenueStats.totalCollected} ج.م</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">عدد المقبوضات: {revenueStats.list.length} إيصالات</p>
              </div>
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">التحصيل النقدي (كاش)</p>
                <h4 className="text-xl font-black text-slate-800 mt-1">{revenueStats.cashSum} ج.م</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">النسبة: {revenueStats.totalCollected > 0 ? Math.round((revenueStats.cashSum / revenueStats.totalCollected) * 100) : 0}% ({revenueStats.cashCount} دفعات)</p>
              </div>
              <div className="bg-slate-50 text-slate-600 p-3 rounded-xl border border-slate-150">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">تحصيل فودافون كاش</p>
                <h4 className="text-xl font-black text-indigo-600 mt-1">{revenueStats.vodafoneSum} ج.م</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">النسبة: {revenueStats.totalCollected > 0 ? Math.round((revenueStats.vodafoneSum / revenueStats.totalCollected) * 100) : 0}% ({revenueStats.vodafoneCount} دفعات)</p>
              </div>
              <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100">
                <TrendingUp className="w-5 h-5 text-indigo-650" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">متوسط قيمة المقبوض</p>
                <h4 className="text-xl font-black text-slate-700 mt-1">{revenueStats.averagePayment} ج.م</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">الفيزا والوسائل الأخرى: {revenueStats.visaSum + revenueStats.otherSum} ج.م</p>
              </div>
              <div className="bg-slate-50 text-slate-600 p-3 rounded-xl border border-slate-100">
                <Users className="w-5 h-5 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List of Payments */}
            <div id="printable-revenues-report" className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {revenueViewMode === 'daily' ? `سجل مقبوضات وتحصيلات يوم: ${revenueDate}` : `سجل مقبوضات وتحصيلات شهر: ${revenueMonth}`}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">كشف المعاملات المحصلة ومصادرها لمطابقة الصندوق والبنك.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleExportRevenuesToExcel}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تصدير Excel
                  </button>
                  <button
                    onClick={() => handlePrint('printable-revenues-report')}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer border border-blue-200"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة الكشف
                  </button>
                </div>
              </div>

              {/* Printable Header (Visible only on print layout) */}
              <div className="hidden print:block p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة — الأستاذ محمود أبوذكري</h2>
                <h3 className="text-lg font-bold text-slate-700">
                  {revenueViewMode === 'daily' 
                    ? `تقرير الإيرادات اليومي التفصيلي لتاريخ: ${revenueDate} (${(() => {
                        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                        const d = new Date(revenueDate);
                        return isNaN(d.getTime()) ? '' : days[d.getDay()];
                      })()})`
                    : `تقرير الإيرادات الشهري التراكمي العام لشهر: ${revenueMonth}`
                  }
                </h3>
                <p className="text-xs text-slate-500">تاريخ طباعة التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
                <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto mt-4 text-xs font-bold border p-3 rounded-lg bg-slate-50 text-right">
                  <div>إجمالي المقبوضات: {revenueStats.totalCollected} ج.م</div>
                  <div>نقداً (كاش السنتر): {revenueStats.cashSum} ج.م</div>
                  <div>محفظة فودافون كاش: {revenueStats.vodafoneSum} ج.م</div>
                  <div>عدد الإيصالات المحصلة: {revenueStats.list.length} إيصال</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-3.5 px-4">كود الطالب</th>
                      <th className="py-3.5 px-4">اسم الطالب</th>
                      <th className="py-3.5 px-4">الصف الدراسي</th>
                      <th className="py-3.5 px-4">التاريخ واليوم</th>
                      <th className="py-3.5 px-4">الشهر المالي</th>
                      <th className="py-3.5 px-4">المبلغ المحصل</th>
                      <th className="py-3.5 px-4">طريقة التحصيل</th>
                      <th className="py-3.5 px-4">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {revenueStats.list.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400 italic font-bold">
                          لا توجد تحصيلات مالية مسجلة تطابق هذه المحددات حالياً.
                        </td>
                      </tr>
                    ) : (
                      revenueStats.list.map((payment) => {
                        const student = students.find(s => s.id === payment.studentId);
                        return (
                          <tr key={payment.id} className="hover:bg-slate-50/40">
                            <td className="py-3 px-4 font-mono font-bold text-slate-500">{student?.code || '—'}</td>
                            <td className="py-3 px-4 font-bold text-slate-800">{payment.studentName}</td>
                            <td className="py-3 px-4 font-medium text-slate-500">{payment.grade}</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-600">
                              {payment.date}
                              <span className="text-[10px] text-slate-400 font-sans block">
                                {(() => {
                                  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                                  const d = new Date(payment.date);
                                  return isNaN(d.getTime()) ? '' : days[d.getDay()];
                                })()}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-indigo-700">{payment.month}</td>
                            <td className="py-3 px-4 font-mono font-black text-emerald-600">{payment.amountPaid} ج.م</td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                                payment.paymentMethod === 'نقدي'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : payment.paymentMethod === 'فودافون كاش'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {payment.paymentMethod}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 max-w-[150px] truncate" title={payment.notes}>
                              {payment.notes || '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Breakdown Sidebar / Quick info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs h-fit space-y-4 no-print">
              {revenueViewMode === 'daily' ? (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-xs text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-indigo-650" />
                    تحليل إحصائي سريع لليوم
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">تاريخ اليوم المختار</span>
                      <strong className="font-mono text-slate-800 font-extrabold">{revenueDate}</strong>
                    </div>
                    <div className="bg-indigo-50/40 p-3 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-indigo-800 font-bold">يوم الأسبوع</span>
                      <strong className="text-indigo-900 font-black">
                        {(() => {
                          const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                          const d = new Date(revenueDate);
                          return isNaN(d.getTime()) ? 'غير صالح' : days[d.getDay()];
                        })()}
                      </strong>
                    </div>
                    <div className="bg-emerald-50/40 p-3 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-emerald-800 font-bold">إجمالي عمليات القبض</span>
                      <strong className="font-mono text-emerald-900 font-black">{revenueStats.list.length} إيصالات</strong>
                    </div>
                    <div className="bg-amber-50/40 p-3 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-amber-800 font-bold">متوسط الدفع لليوم</span>
                      <strong className="font-mono text-amber-900 font-black">{revenueStats.averagePayment} ج.م</strong>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-[11px] text-slate-500 leading-relaxed text-right font-medium">
                    💡 يمكنك فحص إجمالي دخل أي يوم آخر من خلال تغيير "تاريخ اليوم المحدد" في لوحة التحكم العلوية أو من خلال استعراض التقرير الشهري واختيار اليوم المناسب.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                    <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      التحصيلات اليومية خلال الشهر
                    </h4>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black">اضغط للتفصيل</span>
                  </div>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {revenueStats.sortedDays.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 italic py-8">لم يتم تدوين أي تحصيل لليوم حتى الآن.</p>
                    ) : (
                      revenueStats.sortedDays.map((item) => {
                        const dateDayName = (() => {
                          const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                          const d = new Date(item.date);
                          return isNaN(d.getTime()) ? '' : days[d.getDay()];
                        })();
                        return (
                          <div 
                            key={item.date} 
                            onClick={() => {
                              setRevenueDate(item.date);
                              setRevenueViewMode('daily');
                            }}
                            className="bg-slate-50 hover:bg-indigo-50/50 p-3 rounded-xl flex justify-between items-center text-xs border border-transparent hover:border-indigo-150 transition-all cursor-pointer group"
                            title="اضغط للانتقال للتفاصيل اليومية لهذا التاريخ"
                          >
                            <div className="space-y-0.5 text-right">
                              <span className="font-mono text-slate-800 font-bold group-hover:text-indigo-950 transition">{item.date}</span>
                              <span className="text-[10px] text-slate-400 font-medium block">{dateDayName}</span>
                            </div>
                            <strong className="font-mono text-emerald-600 font-black bg-white px-2.5 py-1.5 rounded-lg border border-slate-100 group-hover:border-indigo-200 transition">
                              {item.sum} ج.م
                            </strong>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
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
            <div id="printable-attendance-report" className="bg-white border border-slate-200 rounded-2xl shadow-sm lg:col-span-2 overflow-hidden flex flex-col h-fit">
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
                    onClick={() => handlePrint('printable-attendance-report')}
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
              <div id="printable-exam-report" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
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
                      onClick={() => handlePrint('printable-exam-report')}
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
                  onClick={() => handlePrint('printable-student-certificate')}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  طباعة شهادة الأداء الفردية للطالب
                </button>
              </div>

              {/* Stunning Printable Academic Certificate Card Layout */}
              <div id="printable-student-certificate" className="bg-white border-4 border-slate-900 rounded-3xl p-6 md:p-10 shadow-lg font-sans relative overflow-hidden text-right leading-relaxed print:border-2 print:shadow-none print:p-8">
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

      {/* ========================================================= */}
      {/* 5. TAB: REVISION ROSTERS & MANUAL BOOKING CONFIRMATION    */}
      {/* ========================================================= */}
      {activeTab === 'revisionSheets' && (
        <div className="space-y-6">
          {/* Main Info Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2 no-print">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Printer className="w-5 h-5 text-indigo-650" />
              {rosterType === 'revision' && 'كشوف مراجعة وتصحيح البيانات وتأكيد الحجز يدويًا'}
              {rosterType === 'attendance' && 'كشوف تسجيل حضور وغياب الطلاب يدوياً'}
              {rosterType === 'collection' && 'كشوف تسجيل تحصيل الاشتراكات والمصروفات يدوياً'}
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {rosterType === 'revision' && 'تتيح لك هذه المنطقة طباعة قوائم ورقية منظمة لطلاب كل صف دراسي، مُهيأة للمطابقة الميدانية ومراجعة وتصحيح بيانات المتعلمين وتوقيع تأكيد الحجز والتحصيل يدويًا في السنتر.'}
              {rosterType === 'attendance' && 'تتيح لك طباعة دفاتر ورقية مخصصة لتسجيل حضور وغياب الطلاب يدوياً لكل حصة من الحصص الـ 6 القادمة للمجموعة، لمتابعة الانضباط الفعلي داخل السنتر.'}
              {rosterType === 'collection' && 'تتيح لك طباعة كشوف ورقية خاصة لتسجيل سداد الاشتراكات الشهرية وتدوين قيمة المبالغ والخصومات يدوياً وتوقيع المستلم مع تدوين رقم الإيصال الورقي.'}
            </p>
          </div>

          {/* Roster Type Selector Pills (no-print) */}
          <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl max-w-2xl border border-slate-200/60 no-print">
            <button
              onClick={() => setRosterType('revision')}
              className={`flex-1 min-w-[150px] py-2 px-4 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                rosterType === 'revision' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-650 hover:bg-slate-200/50 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              مراجعة وتأكيد البيانات
            </button>
            <button
              onClick={() => setRosterType('attendance')}
              className={`flex-1 min-w-[150px] py-2 px-4 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                rosterType === 'attendance' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-650 hover:bg-slate-200/50 hover:text-slate-900'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              حضور وغياب يدوي
            </button>
            <button
              onClick={() => setRosterType('collection')}
              className={`flex-1 min-w-[150px] py-2 px-4 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                rosterType === 'collection' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-650 hover:bg-slate-200/50 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              تحصيل اشتراكات يدوي
            </button>
          </div>

          {selectedGrade === 'all' ? (
            /* Dashboard View: All Grades Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
              {(Object.keys(studentsByGrade) as GradeType[]).map((gradeName, idx) => {
                const gradeStudents = studentsByGrade[gradeName];
                const gradeGroups = groups.filter(g => g.grade === gradeName);
                
                return (
                  <div key={gradeName} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-205 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-extrabold text-xs text-slate-800">{gradeName}</h4>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                          مجموعات العلوم ({gradeGroups.length})
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-indigo-50/50 p-2.5 rounded-xl text-center">
                          <span className="text-[10px] text-slate-450 font-bold block">إجمالي الطلاب المقبولين</span>
                          <strong className="text-indigo-750 font-black text-base font-mono">{gradeStudents.length}</strong>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl text-center">
                          <span className="text-[10px] text-slate-450 font-bold block">السعة الاستيعابية للمجموعات</span>
                          <strong className="text-slate-700 font-black text-base font-mono">
                            {gradeGroups.reduce((acc, g) => acc + g.maxCapacity, 0)}
                          </strong>
                        </div>
                      </div>

                      {gradeGroups.length > 0 ? (
                        <div className="space-y-2 mt-3 bg-slate-50 p-3 rounded-xl border border-slate-150">
                          <span className="text-[10px] font-bold text-slate-500 block text-right">طباعة كشوف المجموعات منفصلة:</span>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {gradeGroups.map(g => {
                              const groupStudents = students.filter(s => s.status === 'approved' && s.groupId === g.id);
                              return (
                                <div key={g.id} className="flex justify-between items-center text-[11px] bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs hover:border-slate-300 transition">
                                  <div className="space-y-0.5 text-right">
                                    <strong className="text-slate-800 font-bold block">{g.name}</strong>
                                    <span className="text-[10px] text-slate-450 block font-medium">{g.day} — {g.time} ({groupStudents.length} طالب)</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => handlePrint(`printable-roster-group-${g.id}`)}
                                      disabled={groupStudents.length === 0}
                                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-750 font-bold rounded-md border border-indigo-200 flex items-center gap-1 transition cursor-pointer"
                                      title="طباعة كشف هذه المجموعة منفصلاً"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      طباعة
                                    </button>
                                    <button
                                      onClick={() => handleExportRosterToExcel(`${g.grade} — ${g.name}`, groupStudents)}
                                      disabled={groupStudents.length === 0}
                                      className="p-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 rounded-md border border-slate-200 transition cursor-pointer"
                                      title="تصدير المجموعة لملف Excel"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic pt-1">لا توجد مجموعات مضافة لهذا الصف حالياً.</div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handlePrint(`printable-roster-grade-${idx}`)}
                        disabled={gradeStudents.length === 0}
                        className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        طباعة الكشف الشامل للصف
                      </button>
                      <button
                        onClick={() => handleExportRosterToExcel(gradeName, gradeStudents)}
                        disabled={gradeStudents.length === 0}
                        className="p-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 border border-slate-200 rounded-xl transition cursor-pointer"
                        title="تصدير كجدول Excel"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Detailed Preview View: Single Filtered Grade */
            <div className="space-y-6">
              {/* Roster Controls & Info (no-print) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    معاينة كشف: {selectedGrade}
                    {selectedGroupId !== 'all' && ` — مجموعة: ${groups.find(g => g.id === selectedGroupId)?.name}`}
                  </h4>
                  <p className="text-xs text-slate-450 font-medium">
                    {rosterType === 'revision' && `يحتوي كشف المراجعة هذا على ${activeStudents.length} طالب وطالبة مطابقين لخيارات الفلترة.`}
                    {rosterType === 'attendance' && `يحتوي كشف تسجيل الحضور هذا على ${activeStudents.length} خانة لمتابعة الانضباط للحصص الـ 6 القادمة.`}
                    {rosterType === 'collection' && `يحتوي كشف تسجيل التحصيل هذا على ${activeStudents.length} اسم لتوثيق سداد شهر ${currentMonth} يدوياً.`}
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleExportRosterToExcel(selectedGrade, activeStudents)}
                    disabled={activeStudents.length === 0}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <Download className="w-4 h-4" />
                    تصدير الكشف Excel
                  </button>
                  <button
                    onClick={() => handlePrint('printable-active-roster')}
                    disabled={activeStudents.length === 0}
                    className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة الكشف اليدوي
                  </button>
                </div>
              </div>

              {/* Screen Preview Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm no-print">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-3 px-4 w-12 text-center">م</th>
                        <th className="py-3 px-4 w-24">كود الطالب</th>
                        <th className="py-3 px-4">اسم الطالب رباعي</th>
                        {rosterType === 'revision' && (
                          <>
                            <th className="py-3 px-4">رقم الهاتف</th>
                            <th className="py-3 px-4">هاتف ولي الأمر</th>
                            <th className="py-3 px-4">المجموعة</th>
                            <th className="py-3 px-4">المدرسة</th>
                            <th className="py-3 px-4 text-slate-450 font-medium italic">تعديل البيانات (معاينة)</th>
                            <th className="py-3 px-4 text-slate-450 font-medium italic text-center">تأكيد الحجز</th>
                          </>
                        )}
                        {rosterType === 'attendance' && (
                          <>
                            <th className="py-3 px-4">المجموعة</th>
                            <th className="py-3 px-4">هاتف ولي الأمر</th>
                            {activeHeaders.map((header, sIdx) => (
                              <th key={sIdx} className="py-3 px-4 text-center whitespace-nowrap">{header.label}</th>
                            ))}
                            <th className="py-3 px-4 text-slate-450 font-medium italic">ملاحظات وسلوك الطالب (معاينة)</th>
                          </>
                        )}
                        {rosterType === 'collection' && (
                          <>
                            <th className="py-3 px-4">المجموعة</th>
                            <th className="py-3 px-4">هاتف ولي الأمر</th>
                            <th className="py-3 px-4">الشهر المستحق</th>
                            <th className="py-3 px-4 text-slate-450 font-medium italic">قيمة السداد المطلوب</th>
                            <th className="py-3 px-4 text-slate-450 font-medium italic">رقم الإيصال اليدوي</th>
                            <th className="py-3 px-4 text-slate-450 font-medium italic text-center">توقيع المستلم</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeStudents.length === 0 ? (
                        <tr>
                          <td colSpan={rosterType === 'revision' ? 9 : rosterType === 'attendance' ? (5 + activeHeaders.length + 1) : 9} className="text-center py-12 text-slate-400 italic font-bold">
                            لا يوجد طلاب مقبولين مسجلين في هذا الصف الدراسي/المجموعة حالياً.
                          </td>
                        </tr>
                      ) : (
                        activeStudents.map((student, index) => (
                          <tr key={student.id} className="hover:bg-slate-50/40">
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-450">{index + 1}</td>
                            <td className="py-3 px-4 font-mono font-bold text-indigo-750">{student.code}</td>
                            <td className="py-3 px-4 font-bold text-slate-800">{student.name}</td>
                            
                            {rosterType === 'revision' && (
                              <>
                                <td className="py-3 px-4 font-mono font-medium text-slate-600">{student.phone || '—'}</td>
                                <td className="py-3 px-4 font-mono font-medium text-slate-600">{student.parentPhone}</td>
                                <td className="py-3 px-4 font-semibold text-slate-700">
                                  {groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}
                                </td>
                                <td className="py-3 px-4 text-slate-500">{student.school || '—'}</td>
                                <td className="py-3 px-4 bg-slate-50/25">
                                  <span className="text-[10px] text-slate-350 italic">عمود فارغ للتدوين اليدوي عند الطباعة</span>
                                </td>
                                <td className="py-3 px-4 bg-slate-50/25 text-center">
                                  <span className="inline-block w-4 h-4 border border-slate-200 rounded"></span>
                                </td>
                              </>
                            )}
                            
                            {rosterType === 'attendance' && (
                              <>
                                <td className="py-3 px-4 font-semibold text-slate-700">
                                  {groups.find(g => g.id === student.groupId)?.name || 'غير حدد'}
                                </td>
                                <td className="py-3 px-4 font-mono font-medium text-slate-600">{student.parentPhone}</td>
                                {activeHeaders.map((_, sIdx) => (
                                  <td key={sIdx} className="py-3 px-4 text-center">
                                    <span className="inline-block w-3.5 h-3.5 border border-slate-200 rounded-sm"></span>
                                  </td>
                                ))}
                                <td className="py-3 px-4 bg-slate-50/25">
                                  <span className="text-[10px] text-slate-350 italic">عمود تدوين الغياب والسلوك</span>
                                </td>
                              </>
                            )}
                            
                            {rosterType === 'collection' && (
                              <>
                                <td className="py-3 px-4 font-semibold text-slate-700">
                                  {groups.find(g => g.id === student.groupId)?.name || 'غير حدد'}
                                </td>
                                <td className="py-3 px-4 font-mono font-medium text-slate-600">{student.parentPhone}</td>
                                <td className="py-3 px-4 font-bold text-slate-700">{selectedMonth}</td>
                                <td className="py-3 px-4 bg-slate-50/25">
                                  <span className="text-[10px] text-slate-350 italic">كتابة المبلغ المستلم</span>
                                </td>
                                <td className="py-3 px-4 bg-slate-50/25">
                                  <span className="text-[10px] text-slate-350 italic">رقم الإيصال السنتر</span>
                                </td>
                                <td className="py-3 px-4 bg-slate-50/25 text-center">
                                  <span className="text-[10px] text-slate-350 italic">توقيع الموظف</span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Hidden Print Elements (Rendered in DOM but completely hidden from view screen, used exclusively by print engine) */}
          <div className="hidden">
            {/* 1. All-Grades Hidden Print Targets */}
            {(Object.keys(studentsByGrade) as GradeType[]).map((gradeName, gradeIdx) => {
              const gradeStudents = studentsByGrade[gradeName];
              const gradeHeaders = getAttendanceHeaders('all', gradeName, selectedMonth, groups);
              return (
                <div key={gradeIdx} id={`printable-roster-grade-${gradeIdx}`}>
                  <div className="p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                    <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة للتميز التأسيسي</h2>
                    <h3 className="text-md font-bold text-slate-700">تحت إشراف الأستاذ: محمود أبوذكري</h3>
                    <div className="h-2"></div>
                    <h1 className="text-xl font-black text-blue-700 bg-slate-50 border border-slate-200 py-2.5 rounded-xl">
                      {rosterType === 'revision' && 'كشف مراجعة وتصحيح بيانات الطلاب وتأكيد الحجز يدويًا'}
                      {rosterType === 'attendance' && 'كشف تسجيل حضور وغياب الطلاب يدوياً (دفتر متابعة السنتر)'}
                      {rosterType === 'collection' && 'كشف تسجيل تحصيل اشتراكات ومصروفات الطلاب يدوياً'}
                    </h1>
                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-3 text-xs font-bold text-right">
                      <div>الصف الدراسي: {gradeName}</div>
                      <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
                      <div>إجمالي المقيدين بالصف: {gradeStudents.length} طالب وطالبة</div>
                      <div>مادة الدراسة: العلوم والتأسيس العلمي</div>
                    </div>
                  </div>

                  {rosterType === 'revision' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                          <th style={{ width: '80px' }}>كود الطالب</th>
                          <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                          <th style={{ width: '90px' }}>تليفون الطالب</th>
                          <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                          <th style={{ width: '90px' }}>المجموعة</th>
                          <th style={{ width: '100px' }}>المدرسة والمنطقة</th>
                          <th>تعديل وتصحيح البيانات (يدوياً)</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>تأكيد الحجز والتوقيع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeStudents.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>
                              لا توجد أسماء مسجلة ومقبولة حالياً في هذا الصف الدراسي.
                            </td>
                          </tr>
                        ) : (
                          gradeStudents.map((student, idx) => (
                            <tr key={student.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                              <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.phone || '—'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                              <td>{groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</td>
                              <td>{student.school || '—'}</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                              <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid #94a3b8', borderRadius: '3px' }}></span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {rosterType === 'attendance' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                          <th style={{ width: '80px' }}>كود الطالب</th>
                          <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                          <th style={{ width: '90px' }}>المجموعة</th>
                          <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                          {gradeHeaders.map((sess, sIdx) => (
                            <th key={sIdx} style={{ width: '55px', textAlign: 'center', fontSize: '9px' }}>{sess.label}</th>
                          ))}
                          <th>ملاحظات وسلوك الطالب (يدوياً)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeStudents.length === 0 ? (
                          <tr>
                            <td colSpan={5 + gradeHeaders.length + 1} style={{ textAlign: 'center', padding: '30px' }}>
                              لا توجد أسماء مسجلة ومقبولة حالياً في هذا الصف الدراسي.
                            </td>
                          </tr>
                        ) : (
                          gradeStudents.map((student, idx) => (
                            <tr key={student.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                              <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                              <td>{groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                              {gradeHeaders.map((_, sIdx) => (
                                <td key={sIdx} style={{ textAlign: 'center' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid #cbd5e1', borderRadius: '2px' }}></span></td>
                              ))}
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {rosterType === 'collection' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                          <th style={{ width: '80px' }}>كود الطالب</th>
                          <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                          <th style={{ width: '90px' }}>المجموعة</th>
                          <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                          <th style={{ width: '90px' }}>الشهر المستحق</th>
                          <th style={{ width: '110px' }}>المبلغ المستلم (جنيه)</th>
                          <th style={{ width: '110px' }}>رقم الإيصال الورقي</th>
                          <th>توقيع المحصل وتاريخ الاستلام</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeStudents.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>
                              لا توجد أسماء مسجلة ومقبولة حالياً في هذا الصف الدراسي.
                            </td>
                          </tr>
                        ) : (
                          gradeStudents.map((student, idx) => (
                            <tr key={student.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                              <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                              <td>{groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                              <td style={{ fontWeight: 'bold' }}>{selectedMonth}</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 text-xs">
                    <div>
                      <span className="font-bold block text-slate-400">توقيع موجه المادة:</span>
                      <strong className="block mt-2 text-slate-800">الأستاذ محمود أبوذكري</strong>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <span className="font-bold block text-slate-400">توقيع مسؤول الاستقبال والسنتر:</span>
                      <strong className="block mt-2">..........................................</strong>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 2. Specific Filtered Grade Print Target */}
            <div id="printable-active-roster">
              <div className="p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة للتميز التأسيسي</h2>
                <h3 className="text-md font-bold text-slate-700">تحت إشراف الأستاذ: محمود أبوذكري</h3>
                <div className="h-2"></div>
                <h1 className="text-xl font-black text-blue-700 bg-slate-50 border border-slate-200 py-2.5 rounded-xl">
                  {rosterType === 'revision' && 'كشف مراجعة وتصحيح بيانات الطلاب وتأكيد الحجز يدويًا'}
                  {rosterType === 'attendance' && 'كشف تسجيل حضور وغياب الطلاب يدوياً (دفتر متابعة السنتر)'}
                  {rosterType === 'collection' && 'كشف تسجيل تحصيل اشتراكات ومصروفات الطلاب يدوياً'}
                </h1>
                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-3 text-xs font-bold text-right">
                  <div>الصف الدراسي المختار: {selectedGrade}</div>
                  <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
                  <div>إجمالي المقيدين بالكشف: {activeStudents.length} طالب وطالبة</div>
                  {selectedGroupId !== 'all' && (
                    <div>المجموعة: {groups.find(g => g.id === selectedGroupId)?.name}</div>
                  )}
                  <div>مادة الدراسة: العلوم والتأسيس العلمي</div>
                </div>
              </div>

              {rosterType === 'revision' && (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                      <th style={{ width: '80px' }}>كود الطالب</th>
                      <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                      <th style={{ width: '90px' }}>تليفون الطالب</th>
                      <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                      <th style={{ width: '90px' }}>المجموعة</th>
                      <th style={{ width: '100px' }}>المدرسة والمنطقة</th>
                      <th>تعديل وتصحيح البيانات (يدوياً)</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>تأكيد الحجز والتوقيع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>
                          لا توجد أسماء مسجلة ومقبولة حالياً تطابق خيارات التصفية المحددة.
                        </td>
                      </tr>
                    ) : (
                      activeStudents.map((student, idx) => (
                        <tr key={student.id}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                          <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{student.phone || '—'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                          <td>{groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</td>
                          <td>{student.school || '—'}</td>
                          <td style={{ minHeight: '35px' }}>&nbsp;</td>
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid #94a3b8', borderRadius: '3px' }}></span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {rosterType === 'attendance' && (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                      <th style={{ width: '80px' }}>كود الطالب</th>
                      <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                      <th style={{ width: '90px' }}>المجموعة</th>
                      <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                      {activeHeaders.map((sess, sIdx) => (
                        <th key={sIdx} style={{ width: '55px', textAlign: 'center', fontSize: '9px' }}>{sess.label}</th>
                      ))}
                      <th>ملاحظات وسلوك الطالب (يدوياً)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5 + activeHeaders.length + 1} style={{ textAlign: 'center', padding: '30px' }}>
                          لا توجد أسماء مسجلة ومقبولة حالياً تطابق خيارات التصفية المحددة.
                        </td>
                      </tr>
                    ) : (
                      activeStudents.map((student, idx) => (
                        <tr key={student.id}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                          <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                          <td>{groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                          {activeHeaders.map((_, sIdx) => (
                            <td key={sIdx} style={{ textAlign: 'center' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid #cbd5e1', borderRadius: '2px' }}></span></td>
                          ))}
                          <td style={{ minHeight: '35px' }}>&nbsp;</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {rosterType === 'collection' && (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                      <th style={{ width: '80px' }}>كود الطالب</th>
                      <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                      <th style={{ width: '90px' }}>المجموعة</th>
                      <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                      <th style={{ width: '90px' }}>الشهر المستحق</th>
                      <th style={{ width: '110px' }}>المبلغ المستلم (جنيه)</th>
                      <th style={{ width: '110px' }}>رقم الإيصال الورقي</th>
                      <th>توقيع المحصل وتاريخ الاستلام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>
                          لا توجد أسماء مسجلة ومقبولة حالياً تطابق خيارات التصفية المحددة.
                        </td>
                      </tr>
                    ) : (
                      activeStudents.map((student, idx) => (
                        <tr key={student.id}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                          <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                          <td>{groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                          <td style={{ fontWeight: 'bold' }}>{selectedMonth}</td>
                          <td style={{ minHeight: '35px' }}>&nbsp;</td>
                          <td style={{ minHeight: '35px' }}>&nbsp;</td>
                          <td style={{ minHeight: '35px' }}>&nbsp;</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 text-xs">
                <div>
                  <span className="font-bold block text-slate-400">توقيع موجه المادة:</span>
                  <strong className="block mt-2 text-slate-800">الأستاذ محمود أبوذكري</strong>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <span className="font-bold block text-slate-400">توقيع مسؤول الاستقبال والسنتر:</span>
                  <strong className="block mt-2">..........................................</strong>
                </div>
              </div>
            </div>

            {/* 3. Group Hidden Print Targets */}
            {groups.map((group) => {
              const groupStudents = students.filter(s => s.status === 'approved' && (s.groupId === group.id || (s.alternativeGroupIds && s.alternativeGroupIds.includes(group.id))));
              const groupHeaders = getAttendanceHeaders(group.id, 'all', selectedMonth, groups);
              return (
                <div key={group.id} id={`printable-roster-group-${group.id}`}>
                  <div className="p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                    <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة للتميز التأسيسي</h2>
                    <h3 className="text-md font-bold text-slate-700">تحت إشراف الأستاذ: محمود أبوذكري</h3>
                    <div className="h-2"></div>
                    <h1 className="text-xl font-black text-blue-700 bg-slate-50 border border-slate-200 py-2.5 rounded-xl">
                      {rosterType === 'revision' && 'كشف مراجعة وتصحيح بيانات الطلاب وتأكيد الحجز يدويًا'}
                      {rosterType === 'attendance' && 'كشف تسجيل حضور وغياب الطلاب يدوياً (دفتر متابعة السنتر)'}
                      {rosterType === 'collection' && 'كشف تسجيل تحصيل اشتراكات ومصروفات الطلاب يدوياً'}
                    </h1>
                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-3 text-xs font-bold text-right">
                      <div>المجموعة: {group.name} ({group.grade})</div>
                      <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
                      <div>إجمالي المقيدين بالمجموعة: {groupStudents.length} طالب وطالبة</div>
                      <div>مواعيد المجموعة: {group.day} — {group.time}</div>
                      <div>مادة الدراسة: العلوم والتأسيس العلمي</div>
                    </div>
                  </div>

                  {rosterType === 'revision' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                          <th style={{ width: '80px' }}>كود الطالب</th>
                          <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                          <th style={{ width: '90px' }}>تليفون الطالب</th>
                          <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                          <th style={{ width: '100px' }}>المدرسة والمنطقة</th>
                          <th>تعديل وتصحيح البيانات (يدوياً)</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>تأكيد الحجز والتوقيع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStudents.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                              لا توجد أسماء مسجلة ومقبولة حالياً في هذه المجموعة.
                            </td>
                          </tr>
                        ) : (
                          groupStudents.map((student, idx) => (
                            <tr key={student.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                              <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.phone || '—'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                              <td>{student.school || '—'}</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                              <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1px solid #94a3b8', borderRadius: '3px' }}></span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {rosterType === 'attendance' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                          <th style={{ width: '80px' }}>كود الطالب</th>
                          <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                          <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                          {groupHeaders.map((sess, sIdx) => (
                            <th key={sIdx} style={{ width: '55px', textAlign: 'center', fontSize: '9px' }}>{sess.label}</th>
                          ))}
                          <th>ملاحظات وسلوك الطالب (يدوياً)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStudents.length === 0 ? (
                          <tr>
                            <td colSpan={4 + groupHeaders.length + 1} style={{ textAlign: 'center', padding: '30px' }}>
                              لا توجد أسماء مسجلة ومقبولة حالياً في هذه المجموعة.
                            </td>
                          </tr>
                        ) : (
                          groupStudents.map((student, idx) => (
                            <tr key={student.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                              <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                              {groupHeaders.map((_, sIdx) => (
                                <td key={sIdx} style={{ textAlign: 'center' }}><span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid #cbd5e1', borderRadius: '2px' }}></span></td>
                              ))}
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  {rosterType === 'collection' && (
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                          <th style={{ width: '80px' }}>كود الطالب</th>
                          <th style={{ width: '180px' }}>اسم الطالب رباعي</th>
                          <th style={{ width: '95px' }}>تليفون ولي الأمر</th>
                          <th style={{ width: '90px' }}>الشهر المستحق</th>
                          <th style={{ width: '110px' }}>المبلغ المستلم (جنيه)</th>
                          <th style={{ width: '110px' }}>رقم الإيصال الورقي</th>
                          <th>توقيع المحصل وتاريخ الاستلام</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStudents.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                              لا توجد أسماء مسجلة ومقبولة حالياً في هذه المجموعة.
                            </td>
                          </tr>
                        ) : (
                          groupStudents.map((student, idx) => (
                            <tr key={student.id}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                              <td style={{ fontWeight: 'bold' }}>{student.name}</td>
                              <td style={{ fontFamily: 'monospace' }}>{student.parentPhone}</td>
                              <td style={{ fontWeight: 'bold' }}>{selectedMonth}</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                              <td style={{ minHeight: '35px' }}>&nbsp;</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}

                  <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 text-xs">
                    <div>
                      <span className="font-bold block text-slate-400">توقيع موجه المادة:</span>
                      <strong className="block mt-2 text-slate-800">الأستاذ محمود أبوذكري</strong>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <span className="font-bold block text-slate-400">توقيع مسؤول الاستقبال والسنتر:</span>
                      <strong className="block mt-2">..........................................</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'siblings' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Main Info Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2 no-print">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Users className="w-5 h-5 text-indigo-600" />
              تقرير نظام كشف وتتبع الإخوة الذكي بالسنتر
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              يقوم هذا التقرير بربط حسابات الطلاب تلقائياً وتحديد من لديهم إخوة مسجلين بالسنتر في مادة العلوم بكافة الصفوف الدراسية (الرابع الابتدائي وحتى الثالث الإعدادي) بناءً على مطابقة رقم هاتف ولي الأمر المشترك. يساعد هذا التقرير الإداريين في مراجعة خصومات الإخوة وتنسيق تسليم الشهادات والتواصل العائلي.
            </p>
          </div>

          {/* Sibling KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">إجمالي الطلاب الذين لهم إخوة</p>
                <h4 className="text-xl font-black text-slate-800 mt-1">{siblingData.studentsWithSiblings.length} طالب وطالبة</h4>
                <p className="text-[10px] text-indigo-650 font-bold mt-0.5">من إجمالي المقيدين بالسنتر</p>
              </div>
              <div className="bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400">عدد العوائل / أسر الإخوة</p>
                <h4 className="text-xl font-black text-emerald-600 mt-1">{siblingData.siblingFamilies.length} عائلة مشتركة</h4>
                <p className="text-[10px] text-emerald-600 font-bold mt-0.5">عائلة لديها طالبين أو أكثر</p>
              </div>
              <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex items-center justify-between col-span-1 sm:col-span-2 lg:col-span-1">
              <div>
                <p className="text-[11px] font-bold text-slate-400">أعلى صف يحتوي على إخوة</p>
                <h4 className="text-xl font-black text-blue-600 mt-1 font-sans">
                  {(() => {
                    let maxGrade: string = '—';
                    let maxCount = 0;
                    Object.entries(siblingData.studentsWithSiblingsByGrade).forEach(([grade, list]) => {
                      const typedList = list as any[];
                      if (typedList.length > maxCount) {
                        maxCount = typedList.length;
                        maxGrade = grade;
                      }
                    });
                    return maxGrade === '—' ? 'لا يوجد' : `${maxGrade.split(' ')[1] || maxGrade} (${maxCount})`;
                  })()}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">الصف الأكثر كثافة عائلية</p>
              </div>
              <div className="bg-blue-50 text-blue-700 p-3 rounded-xl border border-blue-100">
                <Star className="w-5 h-5" />
              </div>
            </div>
          </div>

          {selectedGrade === 'all' ? (
            /* Dashboard view showing all grades card-by-card */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
              {(Object.keys(siblingData.studentsWithSiblingsByGrade) as GradeType[]).map((gradeName, idx) => {
                const list = siblingData.studentsWithSiblingsByGrade[gradeName];
                return (
                  <div key={gradeName} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-205 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-extrabold text-xs text-slate-800">{gradeName}</h4>
                        <span className="text-[10px] bg-indigo-50 text-indigo-750 font-bold px-2.5 py-0.5 rounded-full">
                          {list.length} طالب له إخوة
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 mt-3 text-right">
                        <span className="text-[10px] font-bold text-slate-450 block mb-2">عينة من الطلاب الإخوة بهذا الصف:</span>
                        {list.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">لا يوجد طلاب لديهم إخوة مسجلين في هذا الصف.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {list.slice(0, 5).map(item => (
                              <div key={item.student.id} className="text-[11px] bg-white p-2 rounded-lg border border-slate-200/60 shadow-2xs">
                                <strong className="text-slate-800 block font-bold">{item.student.name}</strong>
                                <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
                                  إخوته: {item.siblings.map(sib => `${sib.name} (${sib.grade === item.student.grade ? 'نفس الصف' : sib.grade.split(' ')[1] || sib.grade})`).join('، ')}
                                </span>
                              </div>
                            ))}
                            {list.length > 5 && (
                              <p className="text-[10px] text-slate-400 font-bold text-center mt-1">+{list.length - 5} طلاب آخرين...</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handlePrint(`printable-siblings-grade-${idx}`)}
                        disabled={list.length === 0}
                        className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        طباعة كشف الصف
                      </button>
                      <button
                        onClick={() => handleExportSiblingsToExcel(gradeName, list)}
                        disabled={list.length === 0}
                        className="p-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 border border-slate-200 rounded-xl transition cursor-pointer"
                        title="تصدير كجدول Excel"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Detailed view for single filtered grade */
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    معاينة كشف إخوة: {selectedGrade}
                  </h4>
                  <p className="text-xs text-slate-450 font-medium font-sans">
                    تم العثور على {siblingData.studentsWithSiblingsByGrade[selectedGrade].length} طالب وطالبة لديهم إخوة مسجلين بالسنتر.
                  </p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleExportSiblingsToExcel(selectedGrade, siblingData.studentsWithSiblingsByGrade[selectedGrade])}
                    disabled={siblingData.studentsWithSiblingsByGrade[selectedGrade].length === 0}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <Download className="w-4 h-4" />
                    تصدير الكشف Excel
                  </button>
                  <button
                    onClick={() => handlePrint('printable-siblings-active-grade')}
                    disabled={siblingData.studentsWithSiblingsByGrade[selectedGrade].length === 0}
                    className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة كشف الإخوة
                  </button>
                </div>
              </div>

              {/* On-screen detailed table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm no-print">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-3 px-4 w-12 text-center">م</th>
                        <th className="py-3 px-4 w-24">كود الطالب</th>
                        <th className="py-3 px-4">اسم الطالب رباعي</th>
                        <th className="py-3 px-4">المجموعة الحالية</th>
                        <th className="py-3 px-4">هاتف ولي الأمر</th>
                        <th className="py-3 px-4 text-indigo-700">بيانات الإخوة بالسنتر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {siblingData.studentsWithSiblingsByGrade[selectedGrade].length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-400 italic font-bold">
                            لا يوجد طلاب لديهم إخوة مسجلين بالسنتر في هذا الصف الدراسي حالياً.
                          </td>
                        </tr>
                      ) : (
                        siblingData.studentsWithSiblingsByGrade[selectedGrade]
                          .filter(item => selectedGroupId === 'all' || item.student.groupId === selectedGroupId)
                          .map((item, idx) => (
                            <tr key={item.student.id} className="hover:bg-slate-50/40">
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-450">{idx + 1}</td>
                              <td className="py-3 px-4 font-mono font-bold text-indigo-750">{item.student.code}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{item.student.name}</td>
                              <td className="py-3 px-4 font-semibold text-slate-650">
                                {groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد'}
                              </td>
                              <td className="py-3 px-4 font-mono font-medium text-slate-600">{item.student.parentPhone}</td>
                              <td className="py-3 px-4 bg-indigo-50/15">
                                <div className="space-y-1">
                                  {item.siblings.map(sib => (
                                    <div key={sib.id} className="flex items-center gap-2 justify-start">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                      <span className="font-extrabold text-slate-800">{sib.name}</span>
                                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                        {sib.grade === item.student.grade ? 'نفس الصف الدراسي' : sib.grade}
                                      </span>
                                      <span className="text-[10px] text-slate-450">({groups.find(g => g.id === sib.groupId)?.name || 'مجموعة غير محددة'} — كود: {sib.code})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Hidden Printable Templates for Sibling Report */}
          <div className="hidden">
            {/* 1. All-Grades Hidden Print Targets */}
            {(Object.keys(siblingData.studentsWithSiblingsByGrade) as GradeType[]).map((gradeName, idx) => {
              const list = siblingData.studentsWithSiblingsByGrade[gradeName];
              return (
                <div key={idx} id={`printable-siblings-grade-${idx}`}>
                  <div className="p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                    <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة — الأستاذ محمود أبوذكري</h2>
                    <h3 className="text-md font-bold text-slate-700">كشف وتدقيق أسماء الطلاب الذين لديهم إخوة بالسنتر</h3>
                    <div className="h-1" />
                    <h1 className="text-lg font-black text-indigo-700 bg-slate-50 border border-slate-200 py-2.5 rounded-xl">
                      الصف الدراسي المستهدف: {gradeName}
                    </h1>
                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-3 text-xs font-bold text-right">
                      <div>المادة: العلوم والتأسيس العلمي</div>
                      <div>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</div>
                      <div>عدد الطلاب الذين لهم إخوة بالصف: {list.length} طالب</div>
                      <div>المرجع: هاتف ولي الأمر المطابق</div>
                    </div>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                        <th style={{ width: '80px' }}>كود الطالب</th>
                        <th>اسم الطالب رباعي</th>
                        <th style={{ width: '110px' }}>المجموعة</th>
                        <th style={{ width: '100px' }}>هاتف ولي الأمر</th>
                        <th>بيانات الإخوة المسجلين بالسنتر وصوفهم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>
                            لا توجد أسماء طلاب لديهم إخوة مسجلين في هذا الصف.
                          </td>
                        </tr>
                      ) : (
                        list.map((item, sIdx) => (
                          <tr key={item.student.id}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{sIdx + 1}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{item.student.code}</td>
                            <td style={{ fontWeight: 'bold' }}>{item.student.name}</td>
                            <td>{groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد'}</td>
                            <td style={{ fontFamily: 'monospace' }}>{item.student.parentPhone}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {item.siblings.map(sib => (
                                  <div key={sib.id} style={{ fontSize: '10px' }}>
                                    • <strong>{sib.name}</strong> ({sib.grade === item.student.grade ? 'نفس الصف' : sib.grade} — كود: {sib.code})
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 text-xs">
                    <div>
                      <span className="font-bold block text-slate-400">توقيع المعلم:</span>
                      <strong className="block mt-2 text-slate-800">الأستاذ محمود أبوذكري</strong>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <span className="font-bold block text-slate-400">توقيع المنسق الإداري:</span>
                      <strong className="block mt-2">..........................................</strong>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 2. Specific Active Grade Print Target */}
            <div id="printable-siblings-active-grade">
              <div className="p-6 text-center border-b-2 border-slate-800 font-sans space-y-2">
                <h2 className="text-2xl font-black text-slate-900">مجموعة العلوم الحديثة — الأستاذ محمود أبوذكري</h2>
                <h3 className="text-md font-bold text-slate-700">كشف وتدقيق أسماء الطلاب الذين لديهم إخوة بالسنتر</h3>
                <div className="h-1" />
                <h1 className="text-lg font-black text-indigo-700 bg-slate-50 border border-slate-200 py-2.5 rounded-xl">
                  الصف الدراسي المختار: {selectedGrade}
                </h1>
                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-3 text-xs font-bold text-right">
                  <div>المادة: العلوم والتأسيس العلمي</div>
                  <div>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</div>
                  <div>عدد الطلاب الذين لهم إخوة بالصف: {siblingData.studentsWithSiblingsByGrade[selectedGrade]?.length || 0} طالب</div>
                  <div>المرجع: مطابقة هواتف أولياء الأمور</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>م</th>
                    <th style={{ width: '80px' }}>كود الطالب</th>
                    <th>اسم الطالب رباعي</th>
                    <th style={{ width: '110px' }}>المجموعة</th>
                    <th style={{ width: '100px' }}>هاتف ولي الأمر</th>
                    <th>بيانات الإخوة المسجلين بالسنتر وصوفهم</th>
                  </tr>
                </thead>
                <tbody>
                  {(siblingData.studentsWithSiblingsByGrade[selectedGrade] || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>
                        لا توجد أسماء طلاب لديهم إخوة مسجلين في هذا الصف.
                      </td>
                    </tr>
                  ) : (
                    (siblingData.studentsWithSiblingsByGrade[selectedGrade] || []).map((item, sIdx) => (
                      <tr key={item.student.id}>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{sIdx + 1}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{item.student.code}</td>
                        <td style={{ fontWeight: 'bold' }}>{item.student.name}</td>
                        <td>{groups.find(g => g.id === item.student.groupId)?.name || 'غير محدد'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.student.parentPhone}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {item.siblings.map(sib => (
                              <div key={sib.id} style={{ fontSize: '10px' }}>
                                • <strong>{sib.name}</strong> ({sib.grade === item.student.grade ? 'نفس الصف' : sib.grade} — كود: {sib.code})
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 text-xs">
                <div>
                  <span className="font-bold block text-slate-400">توقيع المعلم:</span>
                  <strong className="block mt-2 text-slate-800">الأستاذ محمود أبوذكري</strong>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <span className="font-bold block text-slate-400">توقيع المنسق الإداري:</span>
                  <strong className="block mt-2">..........................................</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
