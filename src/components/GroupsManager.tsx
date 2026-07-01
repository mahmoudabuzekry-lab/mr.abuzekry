/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Group, GradeType } from '../types';
import { dbEngine } from '../db';
import { Plus, Users, Calendar, Clock, MapPin, Trash2, Edit2, ShieldAlert, CheckCircle } from 'lucide-react';

interface GroupsManagerProps {
  groups: Group[];
  onRefresh: () => void;
}

export default function GroupsManager({ groups, onRefresh }: GroupsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  // Form State
  const [groupForm, setGroupForm] = useState({
    name: '',
    grade: 'الصف الثالث الإعدادي' as GradeType,
    day: 'السبت والثلاثاء',
    time: '04:00 م',
    maxCapacity: 25,
    location: 'السنتر الرئيسي'
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;

    dbEngine.addGroup({
      name: groupForm.name,
      grade: groupForm.grade,
      day: groupForm.day,
      time: groupForm.time,
      maxCapacity: Number(groupForm.maxCapacity),
      location: groupForm.location
    });

    // Reset Form
    setGroupForm({
      name: '',
      grade: 'الصف الثالث الإعدادي',
      day: 'السبت والثلاثاء',
      time: '04:00 م',
      maxCapacity: 25,
      location: 'السنتر الرئيسي'
    });
    setShowAddForm(false);
    onRefresh();
  };

  const handleUpdateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    dbEngine.updateGroup(editingGroup);
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

  return (
    <div className="space-y-6" id="groups-manager">
      {/* Upper Statistics */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-5 rounded-xl shadow-xs border border-slate-205">
        <div>
          <h3 className="font-bold text-slate-850 text-base">إدارة وتوزيع تنظيم المجموعات الدراسية</h3>
          <p className="text-slate-500 text-xs mt-1">توزيع المتعلمين وفقاً للسعات الاستيعابية وتحديد مواعيد الجداول الأسبوعية بدقة لضمان تحصيل متميز.</p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingGroup(null); }}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-850 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إنشاء مجموعة جديدة
        </button>
      </div>

      {/* CREATE FORM COLLAPSIBLE */}
      {showAddForm && (
        <form onSubmit={handleCreateGroup} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 animate-in slide-in-from-top-4 duration-200 text-right">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="font-bold text-slate-900 text-sm">تأسيس مجموعة فيزيائية بالسنتر</h4>
            <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded font-bold">بناء هيكل مجموعة</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم المجموعة (أو الوصف)</label>
              <input
                type="text"
                required
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="مثال: مجموعة نيوتن (أ)"
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
                <option value="الرابع الابتدائي">الصف الرابع الابتدائي</option>
                <option value="الخامس الابتدائي">الصف الخامس الابتدائي</option>
                <option value="السادس الابتدائي">الصف السادس الابتدائي</option>
                <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
              </select>
            </div>

            {/* Days */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">يوم الحضور الأسبوعي</label>
              <input
                type="text"
                required
                value={groupForm.day}
                onChange={(e) => setGroupForm({ ...groupForm, day: e.target.value })}
                placeholder="مثال: السبت والأربعاء"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition"
              />
            </div>

            {/* Timings */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">موعد الوقت والبداية</label>
              <input
                type="text"
                required
                value={groupForm.time}
                onChange={(e) => setGroupForm({ ...groupForm, time: e.target.value })}
                placeholder="مثال: 04:00 مساءً"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition"
              />
            </div>

            {/* Max Capacity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">السعة القصوى للمقاعد *</label>
              <input
                type="number"
                min={5}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {groups.map((group) => {
          const occupancyRate = (group.currentCount / group.maxCapacity) * 100;
          const isFull = group.currentCount >= group.maxCapacity;

          return (
            <div 
              key={group.id} 
              className="bg-white rounded-xl shadow-xs border border-slate-200 hover:border-slate-400 p-5 space-y-4 hover:shadow-sm transition-all duration-200 text-right"
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{group.name}</h4>
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

      {/* EDIT MODAL WINDOW */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">تعديل بيانات المجموعة الأكاديمية</h3>

            <form onSubmit={handleUpdateGroup} className="space-y-4 text-xs font-bold text-right">
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
                <label className="block text-slate-700 mb-1.5">أيام الحضور (مثال: الأحد والثلاثاء)</label>
                <input
                  type="text"
                  required
                  value={editingGroup.day}
                  onChange={(e) => setEditingGroup({ ...editingGroup, day: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1.5">موعد الحصة اليومي</label>
                  <input
                    type="text"
                    required
                    value={editingGroup.time}
                    onChange={(e) => setEditingGroup({ ...editingGroup, time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-405 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1.5">السعة القصوى (المرجوة بالعدد)</label>
                  <input
                    type="number"
                    min={5}
                    required
                    value={editingGroup.maxCapacity}
                    onChange={(e) => setEditingGroup({ ...editingGroup, maxCapacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono outline-none"
                  />
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
                    className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg font-bold transition text-xs cursor-pointer text-center"
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
