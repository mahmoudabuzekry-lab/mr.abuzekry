/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Weekly Attendance Days Planner / Organizer Component
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Student, Group, GradeType, ALL_GRADES } from '../types';
import { dbEngine } from '../db';
import { 
  Calendar, Search, Check, Sparkles, Info, HelpCircle, 
  RefreshCw, CheckSquare, Square, Filter, Printer, Users,
  Settings2, Star, Layers, Clock, X
} from 'lucide-react';

interface WeeklyAttendancePlannerProps {
  students: Student[];
  groups: Group[];
  onRefresh: () => void;
}

const WEEK_DAYS = ['الجمعة', 'السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

const parseGroupDays = (dayStr: string): string[] => {
  if (!dayStr) return [];
  return WEEK_DAYS.filter(d => dayStr.includes(d));
};

const getStudentDefaultDays = (student: Student, groups: Group[]): string[] => {
  const primaryGroup = groups.find(g => g.id === student.groupId);
  const altGroups = (student.alternativeGroupIds || [])
    .map(id => groups.find(g => g.id === id))
    .filter(Boolean) as Group[];

  const allGroups = [primaryGroup, ...altGroups].filter(Boolean) as Group[];
  const daysSet = new Set<string>();
  allGroups.forEach(g => {
    parseGroupDays(g.day).forEach(d => daysSet.add(d));
  });

  return Array.from(daysSet);
};

export default function WeeklyAttendancePlanner({ students, groups, onRefresh }: WeeklyAttendancePlannerProps) {
  const grades = useMemo(() => {
    if (typeof dbEngine.getGrades === 'function') {
      const dbGrades = dbEngine.getGrades();
      if (Array.isArray(dbGrades) && dbGrades.length > 0) return dbGrades;
    }
    return ALL_GRADES;
  }, [students, groups]);

  const [selectedGrade, setSelectedGrade] = useState<GradeType>(() => {
    if (typeof dbEngine.getGrades === 'function') {
      const activeGrades = dbEngine.getGrades();
      if (Array.isArray(activeGrades) && activeGrades.length > 0) return activeGrades[0];
    }
    return ALL_GRADES[0] || 'الصف الثالث الإعدادي';
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoSaveMsg, setAutoSaveMsg] = useState<{ studentId: string; day: string } | null>(null);

  // Modal state for selecting specific groups for multi-group days
  const [groupModalData, setGroupModalData] = useState<{
    student: Student;
    day: string;
    dayGroups: Group[];
  } | null>(null);

  // Reset selectedGroupId when grade changes
  useEffect(() => {
    setSelectedGroupId('all');
  }, [selectedGrade]);

  // Auto-adjust selectedGrade if it's not in the active grades list
  useEffect(() => {
    if (grades.length > 0 && !grades.includes(selectedGrade)) {
      setSelectedGrade(grades[0] as GradeType);
    }
  }, [grades, selectedGrade]);

  // Get all groups for the selected grade
  const gradeGroups = useMemo(() => {
    return groups.filter(g => g.grade === selectedGrade);
  }, [groups, selectedGrade]);

  // Map day name -> list of groups for selectedGrade meeting on that day
  const dayGroupsMap = useMemo(() => {
    const map: Record<string, Group[]> = {};
    WEEK_DAYS.forEach(day => {
      map[day] = gradeGroups.filter(g => parseGroupDays(g.day).includes(day));
    });
    return map;
  }, [gradeGroups]);

  // Filter approved students for selected grade and optional group filter
  const gradeStudents = useMemo(() => {
    return students.filter(s => {
      if (s.status !== 'approved') return false;
      if (s.grade !== selectedGrade) return false;
      
      // Group filter
      if (selectedGroupId !== 'all') {
        const isPrimary = s.groupId === selectedGroupId;
        const isAlt = s.alternativeGroupIds?.includes(selectedGroupId);
        if (!isPrimary && !isAlt) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, selectedGrade, selectedGroupId, searchQuery]);

  // Calculate attendance count and group breakdown for each day of the week
  const dayStats = useMemo(() => {
    const stats: Record<string, { total: number; groupCounts: Record<string, number> }> = {};
    
    WEEK_DAYS.forEach(day => {
      stats[day] = { total: 0, groupCounts: {} };
      (dayGroupsMap[day] || []).forEach(g => {
        stats[day].groupCounts[g.id] = 0;
      });
    });

    const targetStudents = students.filter(s => s.status === 'approved' && s.grade === selectedGrade);
    targetStudents.forEach(student => {
      const defaultDays = getStudentDefaultDays(student, groups);
      const checkedDays = student.attendanceDays || defaultDays;

      checkedDays.forEach(day => {
        if (stats[day]) {
          stats[day].total++;

          // Breakdown per group meeting on this day
          const dayGroups = dayGroupsMap[day] || [];
          dayGroups.forEach(g => {
            const isPrimary = student.groupId === g.id;
            const isAlt = student.alternativeGroupIds?.includes(g.id);
            if (isPrimary || isAlt) {
              stats[day].groupCounts[g.id] = (stats[day].groupCounts[g.id] || 0) + 1;
            }
          });
        }
      });
    });

    return stats;
  }, [students, groups, selectedGrade, dayGroupsMap]);

  // Toggle a day's attendance for a student
  const handleToggleDay = (student: Student, day: string) => {
    const defaultDays = getStudentDefaultDays(student, groups);
    
    // Get currently saved days, defaulting to group days if none are custom saved
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

  // Reset a student's days back to their primary + alternative group defaults
  const handleResetDays = (student: Student) => {
    const updatedStudent: Student = {
      ...student,
      attendanceDays: undefined // removes custom array, falling back to group default
    };
    dbEngine.updateStudent(updatedStudent);
    onRefresh();
  };

  // Toggle alternative group assignment from multi-group modal
  const handleToggleAltGroup = (student: Student, groupId: string) => {
    const currentAlts = student.alternativeGroupIds || [];
    let newAlts: string[];
    if (currentAlts.includes(groupId)) {
      newAlts = currentAlts.filter(id => id !== groupId);
    } else {
      newAlts = [...currentAlts, groupId];
    }

    const updatedStudent: Student = {
      ...student,
      alternativeGroupIds: newAlts
    };

    dbEngine.updateStudent(updatedStudent);
    onRefresh();

    // Update modal reference
    if (groupModalData) {
      setGroupModalData({
        ...groupModalData,
        student: updatedStudent
      });
    }
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
              ميزة الحضور المرن والمجموعات المتعددة 🔄
            </span>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              منظم ومخطط أيام الحضور الأسبوعية للطلاب
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            يتحقق تلقائياً من المجموعات المتعددة المسجلة لنفس الصف خلال نفس اليوم، ويسمح بتخصيص أيام الحضور والمجموعات البديلة لكل طالب بمرونة عالية.
          </p>
        </div>
        
        {/* Help tooltip summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs max-w-sm text-slate-650 space-y-1 self-stretch md:self-auto">
          <div className="flex items-center gap-1 justify-end font-bold text-slate-800">
            <span>دليل الرموز والمجموعات:</span>
            <HelpCircle className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-center gap-1.5 justify-end text-[11px]">
            <span>مجموعة أساسية للبطاقة</span>
            <span className="text-amber-600 text-xs font-bold">⭐ أساسية</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end text-[11px]">
            <span>مجموعة بديلة/حضور مخصص</span>
            <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded-md text-[9px] font-extrabold">🔄 بديلة/مرنة</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end text-[11px]">
            <span>تخصيص مجموعة ليوم به عدة مواعيد</span>
            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-md text-[9px] font-bold">⚡ عدة مجموعات</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-center gap-3 bg-slate-50/70 border border-slate-200/80 p-4 rounded-xl">
        {/* Grade selection */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value as GradeType)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-white border border-slate-250 hover:border-slate-400 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none cursor-pointer transition text-right text-slate-800 shadow-xs"
          >
            {grades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            الصف الدراسي:
          </span>
        </div>

        {/* Group selection */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-white border border-slate-250 hover:border-slate-400 focus:border-indigo-500 rounded-xl text-xs font-bold outline-none cursor-pointer transition text-right text-slate-800 shadow-xs max-w-xs"
          >
            <option value="all">كل مجموعات الصف ({gradeGroups.length} مجموعات)</option>
            {gradeGroups.map(g => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.day} ({g.time || 'بدون توقيت'})
              </option>
            ))}
          </select>
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            المجموعة:
          </span>
        </div>

        {/* Search input */}
        <div className="relative w-full lg:w-64 lg:mr-auto">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-450" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو كود الطالب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-right outline-none transition-all shadow-xs"
          />
        </div>

        {/* Print button */}
        <button
          onClick={handlePrint}
          disabled={gradeStudents.length === 0}
          className="w-full lg:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-55 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
          title="طباعة جدول أيام حضور الطلاب الحالي للعمل عليه يدوياً"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة الجدول 🖨️</span>
        </button>
      </div>

      {/* Weekly Stats Section with Multi-Group Breakdown */}
      <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-3 duration-250">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] text-slate-500 font-bold">
            عدد الطلاب المعروضين: {gradeStudents.length} طالب وطالبة
          </span>
          <h4 className="text-xs font-black text-slate-700 flex items-center justify-end gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-500" />
            إحصائيات توزيع الحضور اليومي وتوزيع المجموعات في {selectedGrade}:
          </h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WEEK_DAYS.map(day => {
            const stat = dayStats[day] || { total: 0, groupCounts: {} };
            const dayGroups = dayGroupsMap[day] || [];
            const hasMultipleGroups = dayGroups.length > 1;

            return (
              <div 
                key={day} 
                className={`bg-white border p-2.5 rounded-xl text-center shadow-2xs transition-all duration-150 flex flex-col items-center justify-between space-y-1.5 ${
                  hasMultipleGroups ? 'border-amber-300 ring-1 ring-amber-200/60 bg-amber-50/10' : 'border-slate-150 hover:border-indigo-300'
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between w-full">
                    {hasMultipleGroups ? (
                      <span className="text-[8px] bg-amber-100 text-amber-900 border border-amber-200 px-1 rounded font-black">
                        {dayGroups.length} مجموعات
                      </span>
                    ) : (
                      <span className="text-[8px] text-slate-400 font-mono">
                        {dayGroups.length > 0 ? (dayGroups[0].time || 'متاحة') : 'لا يوجد'}
                      </span>
                    )}
                    <span className="text-[10px] font-extrabold text-slate-700">{day}</span>
                  </div>

                  <div className="my-1">
                    <span className="text-base font-black text-slate-900 font-sans">{stat.total}</span>
                    <span className="text-[9px] font-bold text-slate-500 mr-1">طالب</span>
                  </div>
                </div>

                {/* Sub-breakdown if multiple groups exist on this day */}
                {dayGroups.length > 0 && (
                  <div className="w-full border-t border-slate-100 pt-1.5 space-y-1 text-[9px]">
                    {dayGroups.map(g => {
                      const gCount = stat.groupCounts[g.id] || 0;
                      return (
                        <div key={g.id} className="flex justify-between items-center text-slate-600 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150/60">
                          <span className="truncate max-w-[70px] text-[8px]" title={g.name}>{g.name}</span>
                          <span className="font-mono text-indigo-700 font-black">{gCount}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
              <th className="py-3 px-3 font-black w-14 text-center">الكود</th>
              <th className="py-3 px-4 font-black min-w-[160px]">اسم الطالب</th>
              <th className="py-3 px-4 font-black min-w-[180px]">المجموعة الأساسية / البديلة</th>
              {WEEK_DAYS.map(day => {
                const dayGroups = dayGroupsMap[day] || [];
                const isMulti = dayGroups.length > 1;

                return (
                  <th 
                    key={day} 
                    className={`py-3 px-2 text-center font-black min-w-[95px] border-r border-slate-150/40 ${
                      isMulti ? 'bg-amber-50/50' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-slate-900">{day}</span>
                      {dayGroups.length === 0 ? (
                        <span className="text-[8px] text-slate-400 font-normal mt-0.5">(لا توجد مجموعات)</span>
                      ) : dayGroups.length === 1 ? (
                        <span className="text-[8px] text-indigo-600 font-bold mt-0.5 truncate max-w-[85px]" title={dayGroups[0].name}>
                          {dayGroups[0].time || dayGroups[0].name}
                        </span>
                      ) : (
                        <span className="text-[8px] bg-amber-100 text-amber-800 border border-amber-250 px-1 py-0.2 rounded font-black mt-0.5" title={dayGroups.map(g => `${g.name} (${g.time})`).join(' | ')}>
                          ⚡ {dayGroups.length} مجموعات
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="py-3 px-3 text-center font-black min-w-[85px]">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150/80">
            {gradeStudents.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 italic">
                  {searchQuery || selectedGroupId !== 'all' 
                    ? 'لا يوجد نتائج مطابقة للبحث وتصفية المجموعات الحالية.' 
                    : `لا يوجد طلاب معتمدين حالياً في ${selectedGrade}.`}
                </td>
              </tr>
            ) : (
              gradeStudents.map(student => {
                const primaryGroup = groups.find(g => g.id === student.groupId);
                const altGroups = (student.alternativeGroupIds || [])
                  .map(id => groups.find(g => g.id === id))
                  .filter(Boolean) as Group[];

                const defaultDays = getStudentDefaultDays(student, groups);
                const isCustomDays = student.attendanceDays !== undefined;
                
                // Effective list of days checked
                const checkedDays = student.attendanceDays || defaultDays;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/40 transition-all">
                    {/* Code */}
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-center">{student.code}</td>
                    
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>{student.name}</span>
                        {isCustomDays && (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-150 text-[8px] px-1.5 py-0.5 rounded-md font-black" title="هذا الطالب يمتلك جدول حضور مرن مخصص">
                            مرن 🔄
                          </span>
                        )}
                        {autoSaveMsg?.studentId === student.id && (
                          <span className="text-[10px] text-emerald-600 font-bold animate-pulse flex items-center gap-0.5">
                            <Check className="w-3.5 h-3.5" />
                            تم الحفظ!
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{student.school || 'عامة'}</p>
                    </td>

                    {/* Primary & Alternative Groups */}
                    <td className="py-3.5 px-4 font-semibold text-slate-650">
                      <div className="space-y-1">
                        {primaryGroup ? (
                          <div className="flex items-center gap-1 text-slate-800 font-bold text-[11px]">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                            <span>{primaryGroup.name}</span>
                            <span className="text-[9px] text-slate-400">({primaryGroup.day})</span>
                          </div>
                        ) : (
                          <span className="text-rose-500 italic text-[11px]">غير مسجل بمجموعة أساسية</span>
                        )}

                        {altGroups.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {altGroups.map(ag => (
                              <span key={ag.id} className="bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.2 rounded text-[9px] font-bold" title={`مجموعة بديلة: ${ag.name} (${ag.day})`}>
                                🔄 بديلة: {ag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Weekday Checkboxes */}
                    {WEEK_DAYS.map(day => {
                      const isChecked = checkedDays.includes(day);
                      const isDefaultDay = defaultDays.includes(day);
                      const dayGroups = dayGroupsMap[day] || [];
                      const hasMultipleGroups = dayGroups.length > 1;

                      // Check if student belongs to any primary or alt group on this day
                      const primaryDayG = dayGroups.find(g => g.id === student.groupId);
                      const altDayGs = dayGroups.filter(g => (student.alternativeGroupIds || []).includes(g.id));
                      
                      return (
                        <td 
                          key={day} 
                          className={`py-2.5 px-2 text-center border-r border-slate-150/40 transition-colors ${
                            isChecked 
                              ? hasMultipleGroups ? 'bg-amber-50/20' : 'bg-indigo-50/20' 
                              : isDefaultDay 
                                ? 'bg-slate-50/60' 
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
                            
                            {/* Group Badges on this day */}
                            {isChecked && (
                              <div className="flex flex-col items-center gap-0.5 w-full">
                                {primaryDayG && (
                                  <span className="text-[8px] bg-amber-50 text-amber-800 border border-amber-200 px-1 rounded font-bold truncate max-w-[85px]" title={`مجموعة أساسية: ${primaryDayG.name}`}>
                                    ⭐ {primaryDayG.name}
                                  </span>
                                )}

                                {altDayGs.map(ag => (
                                  <span key={ag.id} className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 rounded font-bold truncate max-w-[85px]" title={`مجموعة بديلة: ${ag.name}`}>
                                    🔄 {ag.name}
                                  </span>
                                ))}

                                {!primaryDayG && altDayGs.length === 0 && (
                                  <span className="text-[8px] bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded font-extrabold" title="حضور مرن بدون تقييد بمجموعة">
                                    مرن 🔄
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Button to assign specific group if multiple groups meet on this day */}
                            {hasMultipleGroups && (
                              <button
                                type="button"
                                onClick={() => setGroupModalData({ student, day, dayGroups })}
                                className="text-[8px] bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 hover:border-amber-300 text-slate-600 px-1 py-0.5 rounded font-bold transition flex items-center gap-0.5 cursor-pointer mt-0.5"
                                title={`تحديد المجموعة المناسبة لحضور يوم ${day}`}
                              >
                                <Settings2 className="w-2.5 h-2.5 text-amber-600" />
                                <span>مجموعات اليوم</span>
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-center">
                      {isCustomDays ? (
                        <button
                          type="button"
                          onClick={() => handleResetDays(student)}
                          className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                          title="إعادة تعيين جدول الطالب إلى أيام مجموعته الأساسية والبديلة الافتراضية"
                        >
                          إعادة الافتراضي ↩️
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">افتراضي</span>
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
          <p className="font-extrabold text-indigo-900">كيف تنعكس المجموعات المتعددة على التحضير اليومي؟</p>
          <p className="text-[11px] leading-relaxed text-indigo-800">
            إذا احتوى اليوم الواحد على أكثر من مجموعة لنفس الصف (مثلاً مجموعة أ ومجموعة ب يوم السبت)، يمكنك الضغط على زر <strong>(مجموعات اليوم)</strong> بأسفل الخلية لتحديد أو تبديل مجموعة الحضور للطالب بسهولة.
            سيتم إضافة المجموعة المحددة كمجموعة بديلة للطالب، وسيطبق حضوره تلقائياً في تحضير الحصة المقابلة لتلك المجموعة!
          </p>
        </div>
      </div>

      {/* Modal for selecting groups on multi-group days */}
      {groupModalData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-right font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button 
                type="button"
                onClick={() => setGroupModalData(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                  يوم {groupModalData.day}
                </span>
                <h4 className="font-black text-slate-900 text-sm">
                  تحديد مجموعة الحضور للطالب
                </h4>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-0.5">
              <div className="font-bold text-slate-800 flex items-center justify-end gap-1">
                <span>{groupModalData.student.name}</span>
                <span className="font-mono text-indigo-600">({groupModalData.student.code})</span>
              </div>
              <p className="text-[11px] text-slate-500">
                يتوفر {groupModalData.dayGroups.length} مجموعات مسجلة لصف ({selectedGrade}) في يوم ({groupModalData.day}):
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pl-1">
              {groupModalData.dayGroups.map(g => {
                const isPrimary = g.id === groupModalData.student.groupId;
                const isSelectedAlt = (groupModalData.student.alternativeGroupIds || []).includes(g.id);

                if (isPrimary) {
                  return (
                    <div key={g.id} className="p-3 bg-amber-50/80 border border-amber-250 rounded-xl flex items-center justify-between">
                      <span className="text-[10px] bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full font-black">
                        المجموعة الأساسية ⭐
                      </span>
                      <div className="text-right">
                        <div className="font-extrabold text-amber-950 text-xs flex items-center justify-end gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                          <span>{g.name}</span>
                        </div>
                        <div className="text-[10px] text-amber-800 mt-0.5">
                          التوقيت: {g.time || 'غير محدد'} | الكود: {g.id}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <label 
                    key={g.id} 
                    className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition select-none ${
                      isSelectedAlt 
                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelectedAlt}
                      onChange={() => handleToggleAltGroup(groupModalData.student, g.id)}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div className="text-right">
                      <div className="font-extrabold text-slate-800 text-xs flex items-center justify-end gap-1.5">
                        <span>{g.name}</span>
                        {isSelectedAlt && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-full font-black">
                            مجموعة بديلة مضافة 🔄
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        التوقيت: {g.time || 'غير محدد'} | الموقع: {g.location || 'السنتر'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setGroupModalData(null)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div>طريقة الكشف: تلقائي / حضور مرن ومجموعات متعددة</div>
          </div>
        </div>

        <table className="w-full text-right border-collapse text-xs mt-6" style={{ direction: 'rtl', borderCollapse: 'collapse', width: '100%', marginTop: '20px' }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 font-bold">
              <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', width: '40px', backgroundColor: '#f8fafc' }}>م</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', width: '80px', backgroundColor: '#f8fafc' }}>الكود</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', backgroundColor: '#f8fafc' }}>اسم الطالب رباعي</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', width: '140px', backgroundColor: '#f8fafc' }}>المجموعة الأساسية والبديلة</th>
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
                const altGroups = (student.alternativeGroupIds || [])
                  .map(id => groups.find(g => g.id === id))
                  .filter(Boolean) as Group[];

                const defaultDays = getStudentDefaultDays(student, groups);
                const checkedDays = student.attendanceDays || defaultDays;

                return (
                  <tr key={student.id}>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontFamily: 'monospace', fontWeight: 'bold' }}>{student.code}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>
                      {student.name}
                      {student.attendanceDays !== undefined && ' (مرن 🔄)'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontSize: '10px' }}>
                      <div>{primaryGroup ? primaryGroup.name : 'غير مسجل'}</div>
                      {altGroups.length > 0 && (
                        <div style={{ color: '#4338ca', fontWeight: 'bold' }}>
                          بديلة: {altGroups.map(ag => ag.name).join(' | ')}
                        </div>
                      )}
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

