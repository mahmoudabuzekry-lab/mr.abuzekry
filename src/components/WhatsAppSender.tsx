/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { dbEngine } from '../db';
import { WhatsAppTemplate } from '../types';
import { 
  MessageSquare, Save, Info, Copy, CheckCircle2, Plus, Trash2, RotateCcw, 
  Eye, Settings, AlertTriangle, Check, CheckSquare, Sparkles 
} from 'lucide-react';

interface WhatsAppSenderProps {
  templates: WhatsAppTemplate[];
  onRefresh: () => void;
}

const MOCK_DATA = {
  '[اسم_الطالب]': 'أحمد محمد علي',
  '[اسم_المجموعة]': 'مجموعة السبت (الرابع الابتدائي)',
  '[الدرجة]': '19',
  '[الدرجة_النهائية]': '20',
  '[التقييم]': 'ممتاز جداً 🌟',
  '[اسم_الاختبار]': 'اختبار شهر يونيو التجريبي',
  '[الشهر]': 'يونيو',
  '[التاريخ]': '2026/07/02',
  '[الصف_الدراسي]': 'الصف الرابع الابتدائي',
  '[المبلغ]': '80',
  '[الوقت]': '04:00 م'
};

const TEMPLATE_TYPES_MAP: Record<string, string> = {
  'attendance': 'تحضير حضور الطالب',
  'absence': 'تنبيه غياب الطالب',
  'payment_reminder': 'تذكير بالاشتراك المالي',
  'exam_result': 'نتيجة اختبار دوري',
  'announcement': 'إعلان عام للمجموعة',
  'checkout': 'تسجيل انصراف الطالب',
  'custom': 'قالب مخصص آخر'
};

export default function WhatsAppSender({ templates, onRefresh }: WhatsAppSenderProps) {
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<any>('custom');

  // New Template Form Toggle & State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('custom');
  const [newText, setNewText] = useState('');

  // Tabs for previewing: 'raw' or 'preview'
  const [previewModes, setPreviewModes] = useState<Record<string, 'raw' | 'preview'>>({});

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Copy success indicator
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const togglePreviewMode = (id: string) => {
    setPreviewModes(prev => ({
      ...prev,
      [id]: prev[id] === 'preview' ? 'raw' : 'preview'
    }));
  };

  const handleStartEdit = (tpl: WhatsAppTemplate) => {
    setEditingTemplateId(tpl.id);
    setEditText(tpl.text);
    setEditTitle(tpl.title);
    setEditType(tpl.type);
  };

  const handleSave = (tplId: string) => {
    if (!editTitle.trim() || !editText.trim()) {
      triggerToast('يرجى ملء جميع حقول القالب!');
      return;
    }
    const list = dbEngine.getTemplates();
    const updated = list.map(t => t.id === tplId ? { ...t, title: editTitle, type: editType, text: editText } : t);
    dbEngine.setTemplates(updated);
    setEditingTemplateId(null);
    triggerToast('تم تعديل قالب التنبيه وحفظه بنجاح!');
    onRefresh();
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newText.trim()) {
      triggerToast('يرجى كتابة العنوان ونص الرسالة أولاً!');
      return;
    }

    const list = dbEngine.getTemplates();
    const newTpl: WhatsAppTemplate = {
      id: `t_${Date.now()}`,
      title: newTitle.trim(),
      type: newType as any,
      text: newText.trim()
    };

    const updated = [...list, newTpl];
    dbEngine.setTemplates(updated);

    // reset form
    setNewTitle('');
    setNewText('');
    setNewType('custom');
    setShowAddForm(false);
    triggerToast('تمت إضافة قالب الرسالة الجديد بنجاح!');
    onRefresh();
  };

  const handleDelete = (id: string) => {
    if (confirm(`هل أنت متأكد من رغبتك في حذف قالب "${templates.find(t => t.id === id)?.title}" نهائياً؟`)) {
      const list = dbEngine.getTemplates();
      const updated = list.filter(t => t.id !== id);
      dbEngine.setTemplates(updated);
      triggerToast('تم حذف القالب المختار بنجاح!');
      onRefresh();
    }
  };

  const handleResetToDefaults = () => {
    const INITIAL_TEMPLATES: WhatsAppTemplate[] = [
      {
        id: 't1',
        title: 'إشعار تسجيل حضور بنجاح ✅',
        type: 'attendance',
        text: 'ولي الأمر العزيز، نحيطكم علماً بأن الطالب/الطالبة *[اسم_الطالب]* قد حضر اليوم درس العلوم لمجموعة *[اسم_المجموعة]* في تمام الساعة *[الوقت]*. مع تحيات الأستاذ محمود أبوذكري.'
      },
      {
        id: 't2',
        title: 'تنبيه غياب الطالب ⚠️',
        type: 'absence',
        text: 'ولي الأمر العزيز، نود إتصالكم لمراجعة غياب الطالب/الطالبة *[اسم_الطالب]* اليوم عن حضور حصة مادة العلوم المقررة لمجموعة *[اسم_المجموعة]* بتاريخ *[التاريخ]*. يرجى المتابعة لعدم فوات المنهج. الأستاذ محمود أبوذكري.'
      },
      {
        id: 't3',
        title: 'تذكير بمصروفات الاشتراك الشهري 🧾',
        type: 'payment_reminder',
        text: 'ولي الأمر الفاضل، نحيطكم علماً بأن الاشتراك الشهري المستحق لدرس العلوم لشهر *[الشهر]* الخاص بالطالب/الطالبة *[اسم_الطالب]* (الصف: *[الصف_الدراسي]*، المجموعة: *[اسم_المجموعة]*) هو *[المبلغ]* جنيهاً مصرياً. يرجى التكرم بالسداد في أقرب وقت. شاكرين حسن تعاونكم. الأستاذ محمود أبوذكري.'
      },
      {
        id: 't4',
        title: 'إشعار نتيجة اختبار دوري 🏆',
        type: 'exam_result',
        text: 'تهانينا! نود إعلامكم بنتيجة الطالب/الطالبة *[اسم_الطالب]* في *[اسم_الاختبار]* لمادة العلوم. الدرجة: *[الدرجة]* من *[الدرجة_النهائية]* (مستوى التقييم: *[التقييم]*). فخورين بجهوده ونتطلع للمزيد من التميز. الأستاذ محمود أبوذكري.'
      },
      {
        id: 't5',
        title: 'إعلان عام للمجموعة 📢',
        type: 'announcement',
        text: 'أبنائي الطلبة وأولياء الأمور الأفاضل بمجموعة *[اسم_المجموعة]*، نحيطكم علماً بأن الحصة القادمة ستشمل مراجعة شاملة وحل أسئلة بنك المعرفة على الوحدة السابقة، يرجى الاستعداد الجيد وإحضار كراسة التدريبات. الأستاذ محمود أبوذكري.'
      },
      {
        id: 't6',
        title: 'إشعار انصراف الطالب بنجاح 🚶‍♂️',
        type: 'checkout',
        text: 'ولي الأمر العزيز، نحيطكم علماً بأن الطالب/الطالبة *[اسم_الطالب]* قد انصرف وغادر اليوم من درس العلوم لمجموعة *[اسم_المجموعة]* في تمام الساعة *[الوقت]*. مع تمنياتنا له بسلامة الوصول. الأستاذ محمود أبوذكري.'
      }
    ];

    dbEngine.setTemplates(INITIAL_TEMPLATES);
    setConfirmReset(false);
    triggerToast('تمت استعادة كافة القوالب القياسية الافتراضية بنجاح!');
    onRefresh();
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplateId(id);
    setTimeout(() => setCopiedTemplateId(null), 2000);
  };

  const getLivePreviewText = (text: string) => {
    let preview = text;
    Object.entries(MOCK_DATA).forEach(([placeholder, value]) => {
      preview = preview.replaceAll(placeholder, value);
    });
    return preview;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="whatsapp-sender">
      
      {/* Upper Info Box & Global Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-right flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-850 text-lg flex items-center gap-2 justify-end">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            إدارة وتعديل قوالب رسائل واتساب التنبيهية
          </h3>
          <p className="text-slate-500 text-xs leading-relaxed max-w-2xl">
            قم بتصميم النماذج والإشعارات التلقائية التي ترسل وتنسخ مباشرة لأولياء الأمور لتنبيههم بحالة حضور الأبناء والغياب والدفع واختبارات العلوم الخاصة بالأستاذ محمود أبوذكري.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            إضافة قالب جديد
          </button>

          <button
            onClick={() => setConfirmReset(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="استعادة القوالب الافتراضية للدرس"
          >
            <RotateCcw className="w-4 h-4" />
            استعادة الافتراضي
          </button>
        </div>
      </div>

      {/* Confirmation Modal / Block for Resetting to Defaults */}
      {confirmReset && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-right space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start gap-3 justify-end">
            <div className="space-y-1">
              <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5 justify-end">
                <AlertTriangle className="w-4 h-4" />
                تنبيه: استعادة القوالب الافتراضية
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                هل أنت متأكد من رغبتك في استبدال جميع القوالب الحالية بالقوالب الخمسة القياسية للدرس؟ هذا الإجراء سيؤدي إلى فقدان التعديلات والقوالب المخصصة التي قمت بإنشائها.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              onClick={handleResetToDefaults}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              نعم، استعد الافتراضي
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-4 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              إلغاء الأمر
            </button>
          </div>
        </div>
      )}

      {/* Add New Template Form */}
      {showAddForm && (
        <form onSubmit={handleAddNew} className="bg-white border-2 border-blue-100 rounded-2xl p-6 text-right space-y-5 shadow-lg animate-in slide-in-from-top-5 duration-200">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)} 
              className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              إغلاق
            </button>
            <h4 className="font-bold text-slate-850 text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              إنشاء قالب رسالة واتساب جديدة
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">عنوان القالب المميز</label>
              <input
                type="text"
                required
                placeholder="مثال: تنبيه غياب بالإنذار الثاني ⚠️"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs outline-none transition text-right"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">تصنيف التنبيه (النوع)</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs outline-none transition text-right cursor-pointer"
              >
                {Object.entries(TEMPLATE_TYPES_MAP).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">نص الرسالة الأساسي</label>
            <textarea
              rows={4}
              required
              placeholder="اكتب رسالتك هنا... استخدم المتغيرات مثل [اسم_الطالب] و [اسم_المجموعة] لاستبدالها التلقائي لاحقاً."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs outline-none transition text-right leading-relaxed font-sans"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-[10.5px] leading-relaxed flex items-start gap-2 text-blue-900 font-medium">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              يمكنك استخدام المعاملات الذكية ليتم ملؤها ديناميكياً من السجلات:
              <span className="font-mono font-bold text-blue-950 mx-1"> [اسم_الطالب]</span>،
              <span className="font-mono font-bold text-blue-950 mx-1"> [اسم_المجموعة]</span>،
              <span className="font-mono font-bold text-blue-950 mx-1"> [الدرجة]</span>،
              <span className="font-mono font-bold text-blue-950 mx-1"> [الدرجة_النهائية]</span>،
              <span className="font-mono font-bold text-blue-950 mx-1"> [التقييم]</span>،
              <span className="font-mono font-bold text-blue-950 mx-1"> [الشهر]</span>،
              <span className="font-mono font-bold text-blue-950 mx-1"> [المبلغ]</span>.
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              إضافة وحفظ القالب
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Main Templates Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
        {templates.map((tpl) => {
          const isEditing = editingTemplateId === tpl.id;
          const currentMode = previewModes[tpl.id] || 'raw';

          return (
            <div 
              key={tpl.id} 
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 hover:border-slate-350 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Header of Template Card */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div className="space-y-1 text-right">
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 block">عنوان التنبيه</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:bg-white text-right font-bold w-full"
                        />
                      </div>
                    ) : (
                      <h4 className="font-extrabold text-slate-850 text-sm leading-snug">{tpl.title}</h4>
                    )}
                    
                    {isEditing ? (
                      <div className="space-y-1.5 mt-1">
                        <label className="text-[10px] font-bold text-slate-400 block">نوع التنبيه</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value)}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs outline-none focus:bg-white text-right cursor-pointer w-full"
                        >
                          {Object.entries(TEMPLATE_TYPES_MAP).map(([key, value]) => (
                            <option key={key} value={key}>{value}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-0.5 rounded inline-block">
                        نوع التنبيه: {TEMPLATE_TYPES_MAP[tpl.type] || tpl.type}
                      </span>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleStartEdit(tpl)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(tpl.id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-650 border border-red-100 rounded-lg transition cursor-pointer"
                        title="حذف القالب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-1.5 space-x-reverse">
                      <button
                        onClick={() => handleSave(tpl.id)}
                        className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        حفظ
                      </button>
                      <button
                        onClick={() => setEditingTemplateId(null)}
                        className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition hover:bg-slate-200 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>

                {/* Mode Selector (Raw Code vs Interactive Live Chat Preview) */}
                {!isEditing && (
                  <div className="flex justify-end gap-1.5 mt-3">
                    <button
                      onClick={() => togglePreviewMode(tpl.id)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                        currentMode === 'preview'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      {currentMode === 'preview' ? 'عرض الكود الخام' : 'معاينة حية بالبيانات 📲'}
                    </button>
                  </div>
                )}

                {/* Text Area or Mock WhatsApp Message Bubble view */}
                <div className="space-y-2 mt-3 flex-1">
                  {isEditing ? (
                    <textarea
                      rows={5}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 text-xs leading-relaxed text-right outline-none rounded-xl font-sans transition-all"
                    />
                  ) : currentMode === 'preview' ? (
                    /* Elegant WhatsApp Chat Bubble styling */
                    <div className="p-3 bg-[#e5ddd5] dark:bg-slate-800 rounded-xl border border-slate-200/60 font-sans relative overflow-hidden flex flex-col justify-end" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "cover" }}>
                      <div className="bg-[#d9fdd3] text-slate-900 p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] mr-auto text-right text-xs leading-relaxed relative whitespace-pre-line border border-[#c1f2b6]">
                        {getLivePreviewText(tpl.text)}
                        
                        <div className="flex justify-end items-center gap-1 text-[9px] text-slate-500 mt-1.5 font-bold font-mono">
                          <span>10:32 ص</span>
                          <span className="text-blue-500 flex items-center">
                            <Check className="w-3 h-3" />
                            <Check className="w-3 h-3 -mr-1.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-50 text-slate-700 rounded-xl text-xs leading-relaxed border border-slate-200 whitespace-pre-line text-right relative group">
                      {tpl.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Utility action footer inside card */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs mt-3">
                <span className="text-[10px] text-slate-400 font-semibold font-mono">ID: {tpl.id}</span>
                
                <button
                  onClick={() => handleCopyText(currentMode === 'preview' ? getLivePreviewText(tpl.text) : tpl.text, tpl.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    copiedTemplateId === tpl.id 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {copiedTemplateId === tpl.id ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      تم نسخ النص!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      نسخ نص القالب
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guide variables footer bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-right">
        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 justify-end">
          <Info className="w-4 h-4 text-blue-600" />
          دليل استخدام المتغيرات التلقائية في صياغة الرسائل
        </h4>
        <p className="text-slate-500 text-xs leading-relaxed">
          عند كتابة قوالب الرسائل، قم بتضمين الكلمات المحصورة بين قوسين مربعين لتسهيل تبديلها أوتوماتيكياً بسجلات وبيانات الطالب المقيد فور إرسال أو نسخ الإشعار:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right text-xs">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
            <span className="font-extrabold text-slate-900 block font-mono">[اسم_الطالب]</span>
            <span className="text-[10px] text-slate-500">اسم الطالب الثلاثي الكامل</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
            <span className="font-extrabold text-slate-900 block font-mono">[اسم_المجموعة]</span>
            <span className="text-[10px] text-slate-500">اسم المجموعة المقيد بها الطالب</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
            <span className="font-extrabold text-slate-900 block font-mono">[الصف_الدراسي]</span>
            <span className="text-[10px] text-slate-500">الصف الدراسي (رابع، خامس...)</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150">
            <span className="font-extrabold text-slate-900 block font-mono">[الشهر]</span>
            <span className="text-[10px] text-slate-500">اسم الشهر الخاص بالمصروفات</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 font-mono">
            <span className="font-extrabold text-slate-900 block">[الدرجة]</span>
            <span className="text-[10px] text-slate-500 font-sans">الدرجة التي حصل عليها بالاختبار</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 font-mono">
            <span className="font-extrabold text-slate-900 block">[الدرجة_النهائية]</span>
            <span className="text-[10px] text-slate-500 font-sans">الدرجة النهائية العظمى للاختبار</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 font-mono">
            <span className="font-extrabold text-slate-900 block">[التقييم]</span>
            <span className="text-[10px] text-slate-500 font-sans">مستوى تقييم المعلم (ممتاز، مقبول...)</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-150 font-mono">
            <span className="font-extrabold text-slate-900 block">[المبلغ]</span>
            <span className="text-[10px] text-slate-500 font-sans">مستحقات الاشتراك بالجنيه</span>
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      {successMsg && (
        <div className="fixed bottom-4 left-4 bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
