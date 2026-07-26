/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Group, GradeType } from '../types';
import { dbEngine } from '../db';
import { Plus, Users, Calendar, Clock, MapPin, Trash2, Edit2, ShieldAlert, CheckCircle, Sparkles, Star, Crown, Tag, DollarSign, Filter } from 'lucide-react';

// Scheduler Helpers
const parseSchedule = (dayStr: string, timeStr: string): { day: string; time: string }[] => {
  if (!dayStr) return [{ day: 'السبت', time: '04:00 م' }];

  // 1. Check if time has multiple different times separated by '|'
  if (timeStr && timeStr.includes('|')) {
    const segments = timeStr.split('|');
    const schedule: { day: string; time: string }[] = [];
    
    for (const seg of segments) {
      const parts = seg.split(':');
      if (parts.length >= 2) {
        const day = parts[0].trim();
        const time = parts.slice(1).join(':').trim();
        schedule.push({ day, time });
      }
    }
    if (schedule.length > 0) return schedule;
  }

  // 2. Otherwise, parse day string into individual days, and apply the single timeStr to all of them
  const days = dayStr
    .split(/ و |,|،|and/)
    .map(d => d.trim())
    .filter(Boolean);

  if (days.length > 0) {
    return days.map(day => ({
      day,
      time: timeStr || '04:00 م'
    }));
  }

  return [{ day: dayStr, time: timeStr || '04:00 م' }];
};

const compileSchedule = (schedule: { day: string; time: string }[]) => {
  const days = schedule.map(s => s.day).join(' و ');
  
  const firstTime = schedule[0]?.time || '';
  const allSame = schedule.every(s => s.time === firstTime);
  
  let compiledTime = '';
  if (allSame) {
    compiledTime = firstTime;
  } else {
    compiledTime = schedule.map(s => `${s.day}: ${s.time}`).join(' | ');
  }
  return { day: days, time: compiledTime };
};

interface GroupsManagerProps {
  groups: Group[];
  onRefresh: () => void;
}

export default function GroupsManager({ groups, onRefresh }: GroupsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'standard' | 'special'>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');

  // Form State
  const [groupForm, setGroupForm] = useState({
    name: '',
    grade: 'الصف الثالث الإعدادي' as GradeType,
    maxCapacity: 25,
    location: 'السنتر الرئيسي',
    isSpecial: false,
    customPrice: '',
    notes: ''
  });

  const [createSchedule, setCreateSchedule] = useState<{ day: string; time: string }[]>([
    { day: 'السبت', time: '04:00 م' }
  ]);

  const [editSchedule, setEditSchedule] = useState<{ day: string; time: string }[]>([]);

  useEffect(() => {
    if (editingGroup) {
      setEditSchedule(parseSchedule(editingGroup.day, editingGroup.time));
    } else {
      setEditSchedule([]);
    }
  }, [editingGroup]);

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim() || createSchedule.length === 0) return;

    const { day, time } = compileSchedule(createSchedule);

    dbEngine.addGroup({
      name: groupForm.name,
      grade: groupForm.grade,
      day,
      time,
      maxCapacity: Number(groupForm.maxCapacity),
      location: groupForm.location,
      isSpecial: groupForm.isSpecial,
      type: groupForm.isSpecial ? 'special' : 'standard',
      customPrice: groupForm.isSpecial && groupForm.customPrice ? Number(groupForm.customPrice) : undefined,
      notes: groupForm.notes.trim() || undefined
    });

    // Reset Form
    setGroupForm({
      name: '',
      grade: 'الصف الثالث الإعدادي',
      maxCapacity: 25,
      location: 'السنتر الرئيسي',
      isSpecial: false,
      customPrice: '',
      notes: ''
    });
    setCreateSchedule([
      { day: 'السبت', time: '04:00 م' }
    ]);
    setShowAddForm(false);
    onRefresh();
  };

  const handleUpdateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || editSchedule.length === 0) return;

    const { day, time } = compileSchedule(editSchedule);

    dbEngine.updateGroup({
      ...editingGroup,
      day,
      time,
      isSpecial: editingGroup.isSpecial,
      type: editingGroup.isSpecial ? 'special' : 'standard',
      customPrice: editingGroup.isSpecial && editingGroup.customPrice ? Number(editingGroup.customPrice) : undefined,
      notes: editingGroup.notes?.trim() || undefined
    });
    setEditingGroup(null);
    onRefresh();
  };

  const handleDeleteGroup = (group: Group) => {
    setDeletingGroup(group);
  };

  const confirmDeleteGroup = () => {
    if (!deletingGroup) return;
    dbEngine.deleteGroup(deletingGroup.id);
    setDeletingGroup(null);
    onRefresh();
  };

  // Filtered Groups
  const filteredGroups = groups.filter(g => {
    const isSpecialGroup = g.isSpecial || g.type === 'special';
    if (filterType === 'standard' && isSpecialGroup) return false;
    if (filterType === 'special' && !isSpecialGroup) return false;
    if (filterGrade !== 'all' && g.grade !== filterGrade) return false;
    return true;
  });

  const specialCount = groups.filter(g => g.isSpecial || g.type === 'special').length;
  const standardCount = groups.length - specialCount;

  return (
    <div className="space-y-6" id="groups-manager">
      {/* Upper Statistics */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-xl shadow-xs border border-slate-205">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-850 text-base">إدارة وتوزيع تنظيم المجموعات الدراسية</h3>
            {specialCount > 0 && (
              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                {specialCount} مجموعات خاصة (VIP)
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-1">توزيع المتعلمين وفقاً للسعات الاستيعابية وتحديد المجموعات العادية والخاصة ومواعيد الجداول الأسبوعية.</p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingGroup(null); }}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-850 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إنشاء مجموعة جديدة
        </button>
      </div>

      {/* FILTER TABS & GRADE FILTER */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            جميع المجموعات ({groups.length})
          </button>
          <button
            onClick={() => setFilterType('standard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              filterType === 'standard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            المجموعات العادية ({standardCount})
          </button>
          <button
            onClick={() => setFilterType('special')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              filterType === 'special'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            المجموعات الخاصة ⭐ ({specialCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
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
      </div>

      {/* CREATE FORM COLLAPSIBLE */}
      {showAddForm && (
        <form onSubmit={handleCreateGroup} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 animate-in slide-in-from-top-4 duration-200 text-right">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>تأسيس مجموعة فيزيائية بالسنتر</span>
              {groupForm.isSpecial && (
                <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  طابع خاص (مميزة/VIP)
                </span>
              )}
            </h4>
            <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded font-bold">بناء هيكل مجموعة</span>
          </div>

          {/* Group Type Selector (Standard vs Special/VIP) */}
          <div className="bg-gradient-to-r from-amber-50/50 via-orange-50/30 to-slate-50 p-3.5 rounded-xl border border-amber-200/60 space-y-2">
            <label className="block text-xs font-bold text-slate-800">طابع وطبيعة المجموعة</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label 
                className={`flex items-center gap-2.5 p-3 rounded-lg border transition cursor-pointer ${
                  !groupForm.isSpecial 
                    ? 'bg-white border-slate-800 shadow-xs ring-1 ring-slate-800' 
                    : 'bg-white/60 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="groupType"
                  checked={!groupForm.isSpecial}
                  onChange={() => setGroupForm({ ...groupForm, isSpecial: false })}
                  className="accent-slate-900"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">🏢 مجموعة عادية</span>
                  <span className="block text-[10px] text-slate-500">تخضع لتسعيرة الصف الدراسي الافتراضية والتنظيم العام</span>
                </div>
              </label>

              <label 
                className={`flex items-center gap-2.5 p-3 rounded-lg border transition cursor-pointer ${
                  groupForm.isSpecial 
                    ? 'bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-500' 
                    : 'bg-white/60 border-slate-200 hover:bg-amber-50/50'
                }`}
              >
                <input
                  type="radio"
                  name="groupType"
                  checked={groupForm.isSpecial}
                  onChange={() => setGroupForm({ ...groupForm, isSpecial: true })}
                  className="accent-amber-600"
                />
                <div>
                  <span className="block text-xs font-bold text-amber-900 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    مجموعة خاصة / مميزة (VIP)
                  </span>
                  <span className="block text-[10px] text-amber-800/80">إمكانية تحديد سعر مخصص، سعة فائقة، ومتابعة خاصة للطلاب</span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المجموعة (أو الوصف)</label>
              <input
                type="text"
                required
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="مثال: مجموعة نيوتن (أ) أو VIP الفيزياء"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition"
              />
            </div>

            {/* Grade */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الصف المستهدف</label>
              <select
                value={groupForm.grade}
                onChange={(e) => setGroupForm({ ...groupForm, grade: e.target.value as GradeType })}
                className="w-full px-2 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none"
              >
                <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
              </select>
            </div>

            {/* Max Capacity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">السعة القصوى للمقاعد *</label>
              <input
                type="number"
                min={1}
                max={200}
                required
                value={groupForm.maxCapacity}
                onChange={(e) => setGroupForm({ ...groupForm, maxCapacity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono outline-none"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">موقع القاعة (موقع السنتر بالتفصيل)</label>
              <input
                type="text"
                required
                value={groupForm.location}
                onChange={(e) => setGroupForm({ ...groupForm, location: e.target.value })}
                placeholder="مثال: سنتر المعلمين القاعة رقم 1"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none"
              />
            </div>
          </div>

          {/* If Special Group, show custom price & notes inputs */}
          {groupForm.isSpecial && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50/40 p-4 rounded-xl border border-amber-200/80 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  سعر الاشتراك الشهري المخصص للمجموعة (ج.م) - اختياري
                </label>
                <input
                  type="number"
                  min={0}
                  value={groupForm.customPrice}
                  onChange={(e) => setGroupForm({ ...groupForm, customPrice: e.target.value })}
                  placeholder="اتركه فارغاً لاستخدام تسعيرة الصف الافتراضية"
                  className="w-full px-3 py-2 bg-white border border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-right font-mono outline-none"
                />
                <span className="text-[10px] text-amber-700 mt-1 block">
                  إذا تم تحديد سعر مخصص، سيحل محل سعر المصروفات الافتراضي للصف لجميع طلاب هذه المجموعة.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  مميزات / ملاحظات المجموعة الخاصة
                </label>
                <input
                  type="text"
                  value={groupForm.notes}
                  onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                  placeholder="مثال: عدد محدد من الطلاب - متابعة شخصية - قاعة مكيفة"
                  className="w-full px-3 py-2 bg-white border border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-400 rounded-lg text-xs text-right outline-none"
                />
              </div>
            </div>
          )}

          {/* Schedule Builder */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                مواعيد الحضور الأسبوعية (يمكنك تحديد موعد مختلف لكل يوم)
              </span>
              <button
                type="button"
                onClick={() => setCreateSchedule([...createSchedule, { day: 'الأحد', time: '04:00 م' }])}
                className="px-2.5 py-1 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة يوم حضور آخر
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {createSchedule.map((entry, index) => (
                <div key={index} className="flex gap-2 items-center bg-white p-3 rounded-lg border border-slate-200 animate-in fade-in duration-100">
                  <div className="flex-1 text-right">
                    <label className="block text-[10px] text-slate-500 mb-1">اليوم</label>
                    <select
                      value={entry.day}
                      onChange={(e) => {
                        const newSchedule = [...createSchedule];
                        newSchedule[index].day = e.target.value;
                        setCreateSchedule(newSchedule);
                      }}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-md text-xs outline-none text-right"
                    >
                      <option value="السبت">السبت</option>
                      <option value="الأحد">الأحد</option>
                      <option value="الاثنين">الاثنين</option>
                      <option value="الثلاثاء">الثلاثاء</option>
                      <option value="الأربعاء">الأربعاء</option>
                      <option value="الخميس">الخميس</option>
                      <option value="الجمعة">الجمعة</option>
                    </select>
                  </div>
                  <div className="flex-1 text-right">
                    <label className="block text-[10px] text-slate-500 mb-1">الموعد (مثال: 04:00 م)</label>
                    <input
                      type="text"
                      required
                      value={entry.time}
                      onChange={(e) => {
                        const newSchedule = [...createSchedule];
                        newSchedule[index].time = e.target.value;
                        setCreateSchedule(newSchedule);
                      }}
                      placeholder="04:00 م"
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-md text-xs text-right outline-none font-mono"
                    />
                  </div>
                  {createSchedule.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateSchedule(createSchedule.filter((_, i) => i !== index));
                      }}
                      className="mt-4 p-1.5 text-red-500 hover:bg-red-50 rounded-md transition cursor-pointer"
                      title="حذف هذا الموعد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-start">
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-850 transition cursor-pointer"
            >
              حفظ وتأسيس المجموعة
            </button>
          </div>
        </form>
      )}

      {/* Grid of Groups Cards */}
      {filteredGroups.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-600 text-sm font-bold">لا توجد مجموعات مطابقة للفلاتر الحالية</p>
          <p className="text-slate-400 text-xs">يمكنك تغيير فلتر التصفية أو إنشاء مجموعة جديدة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredGroups.map((group) => {
            const occupancyRate = (group.currentCount / group.maxCapacity) * 100;
            const isFull = group.currentCount >= group.maxCapacity;
            const isSpecial = group.isSpecial || group.type === 'special';

            return (
              <div 
                key={group.id} 
                className={`bg-white rounded-xl shadow-xs border p-5 space-y-4 hover:shadow-md transition-all duration-200 text-right relative ${
                  isSpecial 
                    ? 'border-amber-300 hover:border-amber-400 ring-1 ring-amber-200/50 bg-gradient-to-b from-amber-50/20 via-white to-white' 
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                {/* Special Tag Header Banner if applicable */}
                {isSpecial && (
                  <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-amber-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold shadow-xs">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-200 text-white" />
                      مجموعة خاصة (VIP)
                    </span>
                    {group.customPrice ? (
                      <span className="bg-white/20 px-1.5 py-0.5 rounded font-mono">
                        {group.customPrice} ج.م/شهر
                      </span>
                    ) : (
                      <span>سعر مميز</span>
                    )}
                  </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                      {group.name}
                    </h4>
                    <p className="text-slate-500 text-xs mt-1">{group.grade}</p>
                  </div>
                  {isFull ? (
                    <span className="text-[10px] bg-red-50 text-red-750 font-bold px-2.5 py-1 rounded-sm border border-red-100 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      مكتملة بالكامل
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-sm border border-emerald-110 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      شواغر متاحة
                    </span>
                  )}
                </div>

                {/* Data Rows */}
                <div className="space-y-2.5 text-slate-600 text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span>أيام الحضور: <strong className="text-slate-800 font-bold">{group.day}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span>الميقات: <strong className="text-slate-800 font-bold font-sans">{group.time}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <span className="truncate">القاعة: <strong className="text-slate-800 font-bold">{group.location}</strong></span>
                  </div>

                  {group.notes && (
                    <div className="flex items-start gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 font-medium">{group.notes}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <Users className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="w-full">
                      <div className="flex justify-between items-center text-[10px] text-slate-550 mb-1">
                        <span>العدد المستوعب الحالي</span>
                        <span className="font-bold font-sans text-slate-800">{group.currentCount} من {group.maxCapacity} طالب</span>
                      </div>
                      {/* Visual bar */}
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            occupancyRate >= 100 
                              ? 'bg-red-500' 
                              : occupancyRate >= 80 
                              ? 'bg-amber-550' 
                              : isSpecial
                              ? 'bg-amber-500'
                              : 'bg-slate-800'
                          }`}
                          style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2 space-x-reverse">
                  <button
                    onClick={() => setEditingGroup(group)}
                    className="px-2.5 py-1 text-slate-700 hover:bg-slate-50 border border-slate-205 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group)}
                    className="px-2.5 py-1 text-red-650 hover:bg-red-50 border border-red-100 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    حذف المجموعة
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODAL WINDOW */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>تعديل بيانات المجموعة الأكاديمية</span>
              {editingGroup.isSpecial && (
                <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  مجموعة خاصة
                </span>
              )}
            </h3>

            <form onSubmit={handleUpdateGroup} className="space-y-4 text-xs font-bold text-right">
              {/* Special Group Toggle in Edit */}
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingGroup.isSpecial || editingGroup.type === 'special')}
                    onChange={(e) => setEditingGroup({ 
                      ...editingGroup, 
                      isSpecial: e.target.checked,
                      type: e.target.checked ? 'special' : 'standard'
                    })}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    تعيين كمجموعة ذات طابع خاص (خاصة / مميزة VIP)
                  </span>
                </label>

                {(editingGroup.isSpecial || editingGroup.type === 'special') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-amber-200/60">
                    <div>
                      <label className="block text-[11px] text-amber-900 mb-1">سعر مخصص للسياسة المالية (ج.م)</label>
                      <input
                        type="number"
                        min={0}
                        value={editingGroup.customPrice || ''}
                        onChange={(e) => setEditingGroup({ ...editingGroup, customPrice: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="افتراضي الصف"
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 focus:border-amber-500 rounded text-xs outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-amber-900 mb-1">مميزات / ملاحظات</label>
                      <input
                        type="text"
                        value={editingGroup.notes || ''}
                        onChange={(e) => setEditingGroup({ ...editingGroup, notes: e.target.value })}
                        placeholder="وصف مميزات المجموعة"
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 focus:border-amber-500 rounded text-xs outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 mb-1.5">اسم المجموعة</label>
                <input
                  type="text"
                  required
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-450 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1.5">الصف الدراسي المستقر</label>
                <input
                  type="text"
                  disabled
                  value={editingGroup.grade}
                  className="w-full px-3 py-2 bg-gray-100 border border-slate-200 rounded-lg text-xs text-right text-gray-400 cursor-not-allowed font-medium outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1.5">السعة القصوى (المرجوة بالعدد)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editingGroup.maxCapacity}
                  onChange={(e) => setEditingGroup({ ...editingGroup, maxCapacity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono outline-none"
                />
              </div>

              {/* Edit Schedule Builder */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-750 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    جدول مواعيد الحضور الأسبوعية (موعد مخصص لكل يوم)
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditSchedule([...editSchedule, { day: 'الأحد', time: '04:00 م' }])}
                    className="px-2.5 py-1 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة يوم حضور آخر
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editSchedule.map((entry, index) => (
                    <div key={index} className="flex gap-2 items-center bg-white p-3 rounded-lg border border-slate-200 animate-in fade-in duration-100">
                      <div className="flex-1 text-right">
                        <label className="block text-[10px] text-slate-500 mb-1">اليوم</label>
                        <select
                          value={entry.day}
                          onChange={(e) => {
                            const newSchedule = [...editSchedule];
                            newSchedule[index].day = e.target.value;
                            setEditSchedule(newSchedule);
                          }}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-md text-xs outline-none text-right"
                        >
                          <option value="السبت">السبت</option>
                          <option value="الأحد">الأحد</option>
                          <option value="الاثنين">الاثنين</option>
                          <option value="الثلاثاء">الثلاثاء</option>
                          <option value="الأربعاء">الأربعاء</option>
                          <option value="الخميس">الخميس</option>
                          <option value="الجمعة">الجمعة</option>
                        </select>
                      </div>
                      <div className="flex-1 text-right">
                        <label className="block text-[10px] text-slate-500 mb-1">الموعد (مثال: 04:00 م)</label>
                        <input
                          type="text"
                          required
                          value={entry.time}
                          onChange={(e) => {
                            const newSchedule = [...editSchedule];
                            newSchedule[index].time = e.target.value;
                            setEditSchedule(newSchedule);
                          }}
                          placeholder="04:00 م"
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-md text-xs text-right outline-none font-mono"
                        />
                      </div>
                      {editSchedule.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditSchedule(editSchedule.filter((_, i) => i !== index));
                          }}
                          className="mt-4 p-1.5 text-red-500 hover:bg-red-50 rounded-md transition cursor-pointer"
                          title="حذف هذا الموعد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1.5">موقع القاعة والسنتر</label>
                <input
                  type="text"
                  required
                  value={editingGroup.location}
                  onChange={(e) => setEditingGroup({ ...editingGroup, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none"
                />
              </div>

              <div className="pt-4 flex justify-between space-x-2 space-x-reverse">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-lg transition text-xs cursor-pointer"
                >
                  حفظ وتحديث التغييرات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg font-bold transition text-xs cursor-pointer"
                >
                  إلغاء الأمر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL WINDOW */}
      {deletingGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 text-red-600">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                {deletingGroup.currentCount > 0 ? 'تنبيه: لا يمكن حذف المجموعة' : 'تأكيد حذف المجموعة'}
              </h3>
            </div>

            {/* Modal Content */}
            <div className="text-xs text-slate-600 leading-relaxed font-semibold">
              {deletingGroup.currentCount > 0 ? (
                <div className="space-y-2">
                  <p className="text-red-600 font-bold">
                    لا يمكنك حذف مجموعة "{deletingGroup.name}" لأنها تحتوي على ({deletingGroup.currentCount}) من الطلاب النشطين مسجلين بها حالياً!
                  </p>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    لحماية بيانات الطلاب، يرجى تحويل أو نقل الطلاب المسجلين في هذه المجموعة إلى مجموعة أخرى أولاً من خلال صفحة "المتعلمين والطلبات الجديدة"، ثم يمكنك حذف المجموعة بعد ذلك.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-800 text-sm font-bold">
                    هل أنت متأكد تماماً من رغبتك في حذف مجموعة <span className="text-red-600">"{deletingGroup.name}"</span> نهائياً؟
                  </p>
                  <p className="text-slate-400 font-medium leading-relaxed">
                    سيؤدي هذا الإجراء إلى إزالة هذه المجموعة وجدولها الأسبوعي وموقعها بالكامل من سجلات السنتر. لا يمكن استعادة المجموعة بعد تأكيد الحذف.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              {deletingGroup.currentCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-lg transition text-xs cursor-pointer text-center"
                >
                  حسناً، فهمت
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={confirmDeleteGroup}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-xs cursor-pointer text-center"
                  >
                    نعم، احذف المجموعة نهائياً
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingGroup(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg font-bold transition text-xs cursor-pointer text-center text-slate-700"
                  >
                    إلغاء الأمر
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
