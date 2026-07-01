/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { dbEngine } from '../db';
import { WhatsAppTemplate } from '../types';
import { MessageSquare, Save, Settings, Info, Copy, CheckCircle2, Share2 } from 'lucide-react';

interface WhatsAppSenderProps {
  templates: WhatsAppTemplate[];
  onRefresh: () => void;
}

export default function WhatsAppSender({ templates, onRefresh }: WhatsAppSenderProps) {
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const handleStartEdit = (tpl: WhatsAppTemplate) => {
    setEditingTemplateId(tpl.id);
    setEditText(tpl.text);
  };

  const handleSave = (tplId: string) => {
    const list = dbEngine.getTemplates();
    const updated = list.map(t => t.id === tplId ? { ...t, text: editText } : t);
    dbEngine.setTemplates(updated);
    setEditingTemplateId(null);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 2000);
    onRefresh();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="whatsapp-sender">
      <div className="bg-white p-5 rounded-xl border border-slate-200 text-right">
        <h3 className="font-bold text-slate-850 text-base">إدارة وتعديل قوالب رسائل واتساب التنبيهية</h3>
        <p className="text-slate-500 text-xs mt-1 leading-relaxed">
          قم بتصميم نماذج الرسائل والإشعارات التلقائية التي تنسخ وترسل مباشرة للآباء وأولياء الأمور لتنبيههم بحالة الحضور والدفع ونتائج التقييمات العلمية للأستاذ محمود أبوذكري.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
        {templates.map((tpl) => {
          const isEditing = editingTemplateId === tpl.id;

          return (
            <div 
              key={tpl.id} 
              className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 hover:border-slate-400 transition duration-200"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-slate-850 text-sm">{tpl.title}</h4>
                  <span className="text-[9.5px] bg-slate-100 text-slate-800 border border-slate-200 font-bold px-2.5 py-0.5 mt-1.5 rounded inline-block">
                    نوع التنبيه: {tpl.type}
                  </span>
                </div>

                {!isEditing ? (
                  <button
                    onClick={() => handleStartEdit(tpl)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    تعديل القالب
                  </button>
                ) : (
                  <div className="flex space-x-1.5 space-x-reverse">
                    <button
                      onClick={() => handleSave(tpl.id)}
                      className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      حفظ
                    </button>
                    <button
                      onClick={() => setEditingTemplateId(null)}
                      className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-705 text-slate-700 rounded-lg text-xs font-bold transition hover:bg-slate-200 cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>

              {/* Text Area / View */}
              <div className="space-y-2">
                {isEditing ? (
                  <textarea
                    rows={4}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 text-xs leading-relaxed text-right outline-none rounded-lg font-sans transition-all"
                  />
                ) : (
                  <div className="p-3 bg-slate-50 text-slate-705 text-slate-700 rounded-lg text-xs leading-relaxed border border-slate-200 whitespace-pre-line text-right">
                    {tpl.text}
                  </div>
                )}
              </div>

              {/* Variables reference instructions bar */}
              <div className="bg-slate-100 text-slate-800 p-2.5 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5 font-bold border border-slate-200">
                <Info className="w-3.5 h-3.5 text-slate-550 flex-shrink-0 mt-0.5" />
                <div>
                  يتم استبدال المعاملات التالية ديناميكياً بالسجلات المقيدة للطلاب: 
                  <strong className="text-slate-950"> [اسم_الطالب]</strong>، 
                  <strong className="text-slate-950"> [اسم_المجموعة]</strong>، 
                  <strong className="text-slate-950"> [الدرجة]</strong>، 
                  <strong className="text-slate-950"> [الشهر]</strong>، 
                  <strong className="text-slate-950"> [التاريخ]</strong>.
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {successMsg && (
        <div className="fixed bottom-4 left-4 bg-slate-900 border border-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          تم تحديث قوالب الاشعارات بنجاح!
        </div>
      )}
    </div>
  );
}
