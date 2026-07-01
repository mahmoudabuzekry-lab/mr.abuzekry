/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { dbEngine } from '../db';
import { Download, Upload, RefreshCw, CheckCircle, AlertOctagon, HelpCircle, ShieldAlert } from 'lucide-react';

interface DatabaseBackupProps {
  onRefresh: () => void;
}

export default function DatabaseBackup({ onRefresh }: DatabaseBackupProps) {
  const [status, setStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const dataStr = dbEngine.exportDataJSON();
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'abuzekry_science_groups_backup.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      setStatus({ success: 'تم تصدير نسخة احتياطية كاملة من قاعدة البيانات بنجاح!' });
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus({ error: 'عذراً، فشل تصدير البيانات.' });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const ok = dbEngine.importDataJSON(text);
        if (ok) {
          setStatus({ success: 'تم بنجاح وبأمان استرجاع كافة سجلات وقاعدة بيانات السنتر!' });
          onRefresh();
        } else {
          setStatus({ error: 'صيغة ملف النسخ الاحتياطي غير صالحة.' });
        }
      } catch {
        setStatus({ error: 'حدث خطأ غير متوقع أثناء معالجة الملف.' });
      }
      setTimeout(() => setStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    localStorage.clear();
    dbEngine.init();
    setStatus({ success: 'تمت مصادقة واستعادة تهيئة قاعدة البيانات الافتراضية للسنتر بنجاح!' });
    setShowResetConfirm(false);
    onRefresh();
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="database-backup">
      <div className="bg-white p-5 rounded-xl border border-slate-200 text-right">
        <h3 className="font-bold text-slate-850 text-base">النسخ الاحتياطي ومزامنة سجلات السنتر</h3>
        <p className="text-slate-500 text-xs mt-1 leading-relaxed font-semibold">
          احتفظ بنسخة دورية من عملك لحمايته من الفقدان والقدرة على استعادتها وتفادي أي خطأ بطريق الخطأ في السجل المالي والأكاديمي للأستاذ محمود أبوذكري.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
        {/* Export Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-400 transition duration-200 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-850 text-sm">تصدير قاعدة البيانات الحالية</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">قم بتحميل ملف JSON متكامل يضم كافة الطلاب والغياب والمحاسبات والمستحقات والواجبات بضغطة زر لدعم الأمان.</p>
          </div>
          <button
            onClick={handleExport}
            className="w-full py-2.5 bg-slate-900 border border-slate-805 hover:bg-slate-850 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            تحميل ملف النسخة الاحتياطية
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-400 transition duration-200 flex flex-col justify-between space-y-4 font-bold text-xs">
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-850 text-sm">استرجاع نسخة احتياطية سابقة</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">هل قمت بتصدير نسخة احتياطية سابقاً؟ اختر ملف النسخ وتول استرجاع جميع السجلات في ثوان بنجاح.</p>
          </div>
          <div>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              رفع وتطبيق ملف النسخة
            </button>
          </div>
        </div>

        {/* Reset Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-400 transition duration-200 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <h4 className="font-bold text-red-750 text-sm">تهيئة واستعادة شيت البداية</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold font-medium">حذف كافة العمليات والبيانات الحالية وإعادة تصفير قاعدة البيانات لإفراغ مساحة تصفية للطلاب أو بدء نظام جديد.</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2.5 bg-red-50 text-red-655 border border-red-100 hover:bg-red-100 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-red-650" />
            صيانة وإعادة تمهيد افتراضي
          </button>
        </div>
      </div>

      {status?.success && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-bold">{status.success}</span>
        </div>
      )}

      {status?.error && (
        <div className="p-4 bg-red-50 text-red-755 border border-red-100 rounded-lg flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-bold">{status.error}</span>
        </div>
      )}

      {/* RESET DATABASE CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 text-red-600">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                تحذير أمان: استعادة شيت البداية
              </h3>
            </div>

            {/* Modal Content */}
            <div className="text-xs text-slate-600 leading-relaxed font-semibold space-y-3">
              <p className="text-slate-900 text-sm font-bold leading-relaxed">
                تنبيه هام جداً: سيؤدي هذا الإجراء إلى حذف كافة بيانات الطلاب والمجموعات والحسابات والدرجات والواجبات الحالية تماماً من المتصفح!
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                سيتم استبدال البيانات الحالية بالبيانات التعريفية التجريبية الافتراضية للسنتر كشيت بداية نظيف. نوصي بشدة بتحميل نسخة احتياطية أولاً قبل المتابعة.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={confirmReset}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-xs cursor-pointer text-center"
              >
                نعم، تصفير البيانات الآن
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg font-bold transition text-xs cursor-pointer text-center"
              >
                إلغاء الأمر
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
