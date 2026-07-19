/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Weekly Attendance Days Planner / Organizer Component
 */

import React, { useState } from 'react';
import { Student, Group, GradeType } from '../types';
import { dbEngine } from '../db';
import { 
  Calendar, Search, Check, Sparkles, Info, HelpCircle, 
  RefreshCw, CheckSquare, Square, Filter
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
    </div>
  );
}
