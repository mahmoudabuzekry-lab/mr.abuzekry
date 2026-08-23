/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { dbEngine } from '../db';
import { ReceiptSettings, DEFAULT_RECEIPT_SETTINGS, GradeType } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Receipt, Save, RotateCcw, Printer, Eye, Check, Sparkles, 
  Smartphone, Building2, User, Phone, MapPin, MessageSquare, 
  Layers, QrCode, FileText, CheckCircle2, ShieldCheck
} from 'lucide-react';

interface ReceiptCustomizerProps {
  onRefresh?: () => void;
}

export default function ReceiptCustomizer({ onRefresh }: ReceiptCustomizerProps) {
  const [settings, setSettings] = useState<ReceiptSettings>(() => {
    return dbEngine.getReceiptSettings();
  });
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<'card' | 'thermal'>('card');

  useEffect(() => {
    setSettings(dbEngine.getReceiptSettings());
  }, []);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    dbEngine.setReceiptSettings(settings);
    setSaveSuccess(true);
    if (onRefresh) onRefresh();
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleReset = () => {
    if (window.confirm('هل ترغب في استعادة إعدادات وقالب الإيصال الافتراضية؟')) {
      setSettings({ ...DEFAULT_RECEIPT_SETTINGS });
      dbEngine.setReceiptSettings(DEFAULT_RECEIPT_SETTINGS);
      setSaveSuccess(true);
      if (onRefresh) onRefresh();
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
  };

  // Print sample test receipt
  const handleTestPrint = () => {
    const printElement = document.getElementById('mock-receipt-preview');
    if (!printElement) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const isThermal = settings.receiptSize === 'thermal';

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${settings.receiptTitle || 'إيصال استلام مالي'} - تجربة طباعة</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            * {
              font-family: 'Cairo', sans-serif !important;
              box-sizing: border-box;
            }
            @media print {
              body {
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: ${isThermal ? '80mm auto' : 'auto'};
                margin: ${isThermal ? '2mm' : '8mm'};
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body class="bg-white p-4 flex items-center justify-center min-h-screen">
          <div style="width: ${isThermal ? '78mm' : '360px'}; margin: 0 auto; direction: rtl;">
            ${printElement.innerHTML}
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 100);
              }, 250);
            });
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  // Mock payment for live demonstration
  const mockPayment = {
    id: 'REC-2026-8941',
    studentName: 'أحمد محمد محمود السيد',
    grade: 'الصف الثالث الإعدادي' as GradeType,
    month: 'أكتوبر 2026',
    amountPaid: 120,
    amountDue: 120,
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'نقدي',
    receivedBy: settings.receiverName || 'إدارة السنتر / أ. محمود أبوذكري',
    notes: 'تم سداد الاشتراك الشهري وتسليم كراسة المتابعة الأكاديمية'
  };

  return (
    <div className="space-y-6 text-right animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
              <Receipt className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900">تخصيص وتصميم إيصال الاستلام المالي</h3>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
              تحديث مباشر ⚡
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            خصص بيانات الترويسة، اسم المعلم، الشعار، أرقام التواصل، وخيارات العرض (QR، التوقيع، المستحق) للطباعة الحرارية والكلاسيكية.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleTestPrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>تجربة طباعة الإيصال 🖨️</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>استعادة الافتراضي</span>
          </button>
          <button
            type="button"
            onClick={() => handleSave()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>حفظ واعتماد القالب ✨</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>تم حفظ وتحديث قالب وإعدادات الإيصال المالي بنجاح! سيتم تطبيقها تلقائياً على كافة الإيصالات.</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-mono">سحابياً ومحلياً ✅</span>
        </div>
      )}

      {/* Main Grid: Settings Editor & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Settings Form Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Section 1: Main Branding & Headers */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-slate-700" />
              <h4 className="text-sm font-extrabold text-slate-900">بيانات الترويسة واسم الجهة التعليمية</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم السنتر / المجموعة الرئيسية:</label>
                <input
                  type="text"
                  value={settings.centerName}
                  onChange={e => setSettings({ ...settings, centerName: e.target.value })}
                  placeholder="مثال: مجموعات العلوم المتطورة"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المعلم / الأستاذ:</label>
                <input
                  type="text"
                  value={settings.teacherName}
                  onChange={e => setSettings({ ...settings, teacherName: e.target.value })}
                  placeholder="مثال: الأستاذ محمود أبوذكري"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان السند / نوع الإيصال:</label>
                <input
                  type="text"
                  value={settings.receiptTitle}
                  onChange={e => setSettings({ ...settings, receiptTitle: e.target.value })}
                  placeholder="مثال: إيصال استلام مالي / سند قبض"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الشعار الفرعي / الوصف التوضيحي:</label>
                <input
                  type="text"
                  value={settings.subTitle}
                  onChange={e => setSettings({ ...settings, subTitle: e.target.value })}
                  placeholder="مثال: سجل المتابعة والتفوق الأكاديمي الرقمي"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Receiver Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <Phone className="w-4 h-4 text-slate-700" />
              <h4 className="text-sm font-extrabold text-slate-900">بيانات التواصل والمستلم الافتراضي</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">أرقام التواصل / خدمة أولياء الأمور:</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={e => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="مثال: 010xxxxxxxx - 011xxxxxxxx"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المستلم / المحصل الافتراضي:</label>
                <input
                  type="text"
                  value={settings.receiverName}
                  onChange={e => setSettings({ ...settings, receiverName: e.target.value })}
                  placeholder="مثال: إدارة السنتر / أ. محمود أبوذكري"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">العنوان / مقر السنتر أو القاعة (اختياري):</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={e => setSettings({ ...settings, address: e.target.value })}
                  placeholder="مثال: مقر سنتر التفوق - شارع المحطة"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Footer & Encouragement Message */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <MessageSquare className="w-4 h-4 text-slate-700" />
              <h4 className="text-sm font-extrabold text-slate-900">عبارة الشكر والختام في أسفل الإيصال</h4>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">نص الرسالة التحفيزية أو الشكر:</label>
              <textarea
                value={settings.footerMessage}
                onChange={e => setSettings({ ...settings, footerMessage: e.target.value })}
                rows={2}
                placeholder="مثال: * نشكركم على ثقتكم الغالية، تمنياتنا دائماً بدوام المجد والتفوق *"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden transition resize-none"
              />
            </div>
          </div>

          {/* Section 4: Display Toggles & Print Size */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
              <Layers className="w-4 h-4 text-slate-700" />
              <h4 className="text-sm font-extrabold text-slate-900">خيارات ومكونات الإيصال النشطة</h4>
            </div>

            {/* Print format selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-2">المقاس الافتراضي للطباعة:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, receiptSize: 'standard' })}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center justify-between ${
                    settings.receiptSize === 'standard'
                      ? 'bg-blue-50 border-blue-500 text-blue-950 font-black ring-1 ring-blue-500'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold block">بطاقة قياسية كلاسيكية (A5/A4/Card)</span>
                    <span className="text-[10px] text-slate-500">مظهر إداري كامل وأنيق مع إطارات</span>
                  </div>
                  {settings.receiptSize === 'standard' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, receiptSize: 'thermal' })}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-center justify-between ${
                    settings.receiptSize === 'thermal'
                      ? 'bg-blue-50 border-blue-500 text-blue-950 font-black ring-1 ring-blue-500'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold block">ورق كاشير حراري (80mm Thermal POS)</span>
                    <span className="text-[10px] text-slate-500">طباعة سريعة ومدمجة لماكينات الفواتير</span>
                  </div>
                  {settings.receiptSize === 'thermal' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </button>
              </div>
            </div>

            {/* Checkboxes / Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.showQrCode}
                  onChange={e => setSettings({ ...settings, showQrCode: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">رمز التحقق الذكي (QR Code)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.showSignature}
                  onChange={e => setSettings({ ...settings, showSignature: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">خانة توقيع المشرف / المحصل</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.showAmountDue}
                  onChange={e => setSettings({ ...settings, showAmountDue: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">تفصيل الرسوم المستحقة والمتبقي</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.showNotes}
                  onChange={e => setSettings({ ...settings, showNotes: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">صندوق الملاحظات الإضافية</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.showPhone}
                  onChange={e => setSettings({ ...settings, showPhone: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">أرقام التواصل في الترويسة</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={settings.showWatermark}
                  onChange={e => setSettings({ ...settings, showWatermark: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-800">العلامة المائية الرسمية (ختم معتمد)</span>
              </label>
            </div>
          </div>

        </div>

        {/* Right / Live Preview Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-black text-slate-900">المعاينة الحية التفاعلية</h4>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                {settings.receiptSize === 'thermal' ? 'حراري 80mm' : 'بطاقة قياسية'}
              </span>
            </div>

            {/* Container for Preview */}
            <div className="bg-slate-100 p-4 rounded-xl flex justify-center items-center overflow-x-auto min-h-[460px]">
              
              {/* Actual Mock Receipt to preview and print */}
              <div 
                id="mock-receipt-preview"
                className={`bg-white rounded-xl shadow-md border border-slate-300 text-right space-y-3 font-sans transition-all ${
                  settings.receiptSize === 'thermal' 
                    ? 'w-[290px] p-4 text-[11px]' 
                    : 'w-[335px] p-5 text-xs'
                }`}
                style={{ direction: 'rtl' }}
              >
                {/* Header */}
                <div className="text-center border-b-2 border-slate-800 pb-2.5 space-y-1">
                  <div className="inline-flex items-center justify-center gap-1 text-slate-900 font-black text-xs">
                    <span>🔬</span>
                    <span>{settings.centerName || 'مجموعات العلوم المتطورة'}</span>
                  </div>
                  <h4 className="font-extrabold text-slate-950 text-sm tracking-tight">
                    {settings.teacherName || 'الأستاذ محمود أبوذكري'}
                  </h4>
                  {settings.subTitle && (
                    <p className="text-[9px] text-slate-500 font-bold">
                      {settings.subTitle}
                    </p>
                  )}
                  {settings.showPhone && settings.phone && (
                    <p className="text-[9px] text-slate-600 font-mono font-bold">
                      📞 {settings.phone}
                    </p>
                  )}
                </div>

                {/* Receipt Title Badge */}
                <div className="text-center py-1 bg-slate-100 rounded-md border border-slate-200">
                  <span className="text-[11px] font-black text-slate-900 tracking-wider">
                    {settings.receiptTitle || 'إيصال استلام مالي'}
                  </span>
                </div>

                {/* Metadata Row */}
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">رقم الإيصال:</span>
                    <span className="font-mono font-bold text-slate-900">{mockPayment.id}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">تاريخ السداد:</span>
                    <span className="font-mono font-bold text-slate-900">{mockPayment.date}</span>
                  </div>

                  <div className="border-t border-dashed border-slate-300 my-1.5"></div>

                  {/* Student details */}
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">اسم الطالب:</span>
                      <strong className="text-slate-950 font-black">{mockPayment.studentName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">الصف الدراسي:</span>
                      <strong className="text-slate-900 font-bold">{mockPayment.grade}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">عن شهر:</span>
                      <strong className="text-blue-900 font-black">{mockPayment.month}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">طريقة الدفع:</span>
                      <span className="text-slate-800 font-bold">{mockPayment.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  {settings.showNotes && mockPayment.notes && (
                    <div className="bg-amber-50/80 p-2 border border-amber-200 rounded-md text-[10px] text-amber-900 font-medium">
                      <span className="font-bold">ملاحظات: </span>
                      {mockPayment.notes}
                    </div>
                  )}

                  {/* Amounts breakdown */}
                  <div className="space-y-1 pt-1">
                    {settings.showAmountDue && (
                      <div className="flex justify-between text-[11px] text-slate-500 font-medium px-1">
                        <span>إجمالي المقرر الشهري:</span>
                        <span className="font-bold text-slate-700">{mockPayment.amountDue} ج.م</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center bg-emerald-50 p-2.5 border border-emerald-300 rounded-lg">
                      <span className="font-black text-emerald-950 text-xs">المبلغ المسدد (الصافي):</span>
                      <span className="text-base font-black text-emerald-850 font-mono">{mockPayment.amountPaid} ج.م</span>
                    </div>
                    {settings.showAmountDue && mockPayment.amountDue > mockPayment.amountPaid && (
                      <div className="flex justify-between text-[11px] text-red-650 font-bold px-1">
                        <span>المتبقي المطلوب:</span>
                        <span>{mockPayment.amountDue - mockPayment.amountPaid} ج.م</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code & Receiver Signature */}
                  {(settings.showQrCode || settings.showSignature) && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
                      {settings.showQrCode && (
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-white border border-slate-300 rounded-md shadow-2xs">
                            <QRCodeSVG 
                              value={`ABUZEKRY-RECEIPT:${mockPayment.id}|${mockPayment.studentName}|${mockPayment.amountPaid}|${mockPayment.date}`} 
                              size={48} 
                              level="M"
                            />
                          </div>
                          <div className="text-[8px] text-slate-400 font-bold leading-tight">
                            <span>رمز تحقق</span><br/>
                            <span>رقمي معتمد</span>
                          </div>
                        </div>
                      )}

                      {settings.showSignature && (
                        <div className="text-left space-y-0.5">
                          <span className="text-[9px] text-slate-500 font-bold block">المستلم / المحصل:</span>
                          <span className="text-[10px] font-black text-slate-900 block">{settings.receiverName || mockPayment.receivedBy}</span>
                          <span className="text-[8px] text-slate-400 italic">.................. (التوقيع)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Watermark/Stamp */}
                  {settings.showWatermark && (
                    <div className="text-center py-0.5">
                      <span className="inline-block border border-blue-300 bg-blue-50 text-blue-900 text-[9px] font-black px-2 py-0.5 rounded-full">
                        ✓ معتمد بالدفاتر المالية الرسمية
                      </span>
                    </div>
                  )}

                  {/* Address */}
                  {settings.address && (
                    <p className="text-[9px] text-slate-400 text-center font-medium">
                      📍 {settings.address}
                    </p>
                  )}

                  {/* Footer message */}
                  {settings.footerMessage && (
                    <div className="text-center pt-2 border-t border-dashed border-slate-300 text-[9px] text-slate-500 font-bold italic leading-relaxed">
                      {settings.footerMessage}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Quick Actions underneath Preview */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleTestPrint}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة المعاينة الحالية</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ</span>
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
