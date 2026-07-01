/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { dbEngine } from '../db';
import { Download, Upload, RefreshCw, CheckCircle, AlertOctagon, HelpCircle, ShieldAlert, KeyRound, Cloud, CloudOff, Database, Settings } from 'lucide-react';
import { isCustomConfigUsed } from '../firebase';

interface DatabaseBackupProps {
  onRefresh: () => void;
}

export default function DatabaseBackup({ onRefresh }: DatabaseBackupProps) {
  const [status, setStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdStatus, setPwdStatus] = useState<{ success?: string; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firebase states
  const [firebaseEnabled, setFirebaseEnabled] = useState(dbEngine.isFirebaseEnabled());
  const [syncLoading, setSyncLoading] = useState<'push' | 'pull' | null>(null);
  const [lastSync, setLastSync] = useState(localStorage.getItem('abuzekry_last_firebase_sync') || 'لم يتم المزامنة مسبقاً');

  // Custom Firebase Config states
  const [showCustomConfigForm, setShowCustomConfigForm] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [customProjectId, setCustomProjectId] = useState('');
  const [customDatabaseId, setCustomDatabaseId] = useState('(default)');
  const [customAuthDomain, setCustomAuthDomain] = useState('');
  const [customStorageBucket, setCustomStorageBucket] = useState('');
  const [customMessagingSenderId, setCustomMessagingSenderId] = useState('');
  const [customAppId, setCustomAppId] = useState('');
  const [pasteJsonText, setPasteJsonText] = useState('');

  // Load custom firebase config values on init
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('abuzekry_custom_firebase_config');
      if (stored) {
        const custom = JSON.parse(stored);
        if (custom) {
          setCustomApiKey(custom.apiKey || '');
          setCustomProjectId(custom.projectId || '');
          setCustomDatabaseId(custom.databaseId || '(default)');
          setCustomAuthDomain(custom.authDomain || '');
          setCustomStorageBucket(custom.storageBucket || '');
          setCustomMessagingSenderId(custom.messagingSenderId || '');
          setCustomAppId(custom.appId || '');
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleParseJson = (text: string) => {
    setPasteJsonText(text);
    try {
      let cleaned = text.trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        cleaned = match[0];
      }
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const apiKeyMatch = cleaned.match(/apiKey\s*:\s*["']([^"']+)["']/);
        const projectIdMatch = cleaned.match(/projectId\s*:\s*["']([^"']+)["']/);
        const databaseIdMatch = cleaned.match(/databaseId\s*:\s*["']([^"']+)["']/);
        const authDomainMatch = cleaned.match(/authDomain\s*:\s*["']([^"']+)["']/);
        const storageBucketMatch = cleaned.match(/storageBucket\s*:\s*["']([^"']+)["']/);
        const messagingSenderIdMatch = cleaned.match(/messagingSenderId\s*:\s*["']([^"']+)["']/);
        const appIdMatch = cleaned.match(/appId\s*:\s*["']([^"']+)["']/);

        parsed = {};
        if (apiKeyMatch) parsed.apiKey = apiKeyMatch[1];
        if (projectIdMatch) parsed.projectId = projectIdMatch[1];
        if (databaseIdMatch) parsed.databaseId = databaseIdMatch[1];
        if (authDomainMatch) parsed.authDomain = authDomainMatch[1];
        if (storageBucketMatch) parsed.storageBucket = storageBucketMatch[1];
        if (messagingSenderIdMatch) parsed.messagingSenderId = messagingSenderIdMatch[1];
        if (appIdMatch) parsed.appId = appIdMatch[1];
      }

      if (parsed && (parsed.apiKey || parsed.projectId)) {
        if (parsed.apiKey) setCustomApiKey(parsed.apiKey);
        if (parsed.projectId) setCustomProjectId(parsed.projectId);
        if (parsed.databaseId) setCustomDatabaseId(parsed.databaseId);
        if (parsed.authDomain) setCustomAuthDomain(parsed.authDomain);
        if (parsed.storageBucket) setCustomStorageBucket(parsed.storageBucket);
        if (parsed.messagingSenderId) setCustomMessagingSenderId(parsed.messagingSenderId);
        if (parsed.appId) setCustomAppId(parsed.appId);
        
        setStatus({ success: 'تم قراءة وتحليل بيانات كود الاتصال ولصقها في الحقول أدناه بنجاح!' });
        setTimeout(() => setStatus(null), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCustomConfig = () => {
    if (!customApiKey.trim() || !customProjectId.trim()) {
      setStatus({ error: 'برجاء تعيين حقول مفتاح الـ API والـ Project ID الأساسية لحفظ الاتصال.' });
      return;
    }

    const config = {
      apiKey: customApiKey.trim(),
      projectId: customProjectId.trim(),
      databaseId: customDatabaseId.trim(),
      authDomain: customAuthDomain.trim(),
      storageBucket: customStorageBucket.trim(),
      messagingSenderId: customMessagingSenderId.trim(),
      appId: customAppId.trim()
    };

    localStorage.setItem('abuzekry_custom_firebase_config', JSON.stringify(config));
    setStatus({ success: 'تم حفظ إعدادات فاير بيز بنجاح! سيتم إعادة تحميل الصفحة الآن لتطبيق الاتصال الجديد...' });
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleClearCustomConfig = () => {
    localStorage.removeItem('abuzekry_custom_firebase_config');
    setStatus({ success: 'تم إلغاء الاتصال المخصص بنجاح والرجوع لقاعدة البيانات الافتراضية. سيتم تحديث الصفحة الآن...' });
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handlePushToFirebase = async () => {
    setSyncLoading('push');
    setStatus(null);
    try {
      await dbEngine.syncAllToFirebase();
      setLastSync(new Date().toISOString());
      setStatus({ success: 'تم بنجاح وبسرعة رفع ومزامنة كامل قاعدة البيانات الحالية على سحابة فاير بيز الخاصة بك! جميع الأجهزة متزامنة الآن.' });
    } catch (err: any) {
      console.error(err);
      setStatus({ error: `عذراً، فشل رفع البيانات للرابط السحابي: ${err.message || err}` });
    } finally {
      setSyncLoading(null);
      setTimeout(() => setStatus(null), 6000);
    }
  };

  const handlePullFromFirebase = async () => {
    setSyncLoading('pull');
    setStatus(null);
    try {
      const ok = await dbEngine.syncAllFromFirebase();
      if (ok) {
        setLastSync(new Date().toISOString());
        setStatus({ success: 'تم بنجاح تحميل واستيراد أحدث سجلات وقاعدة بيانات السنتر من سحابة فاير بيز وتطبيقها على المتصفح!' });
        onRefresh();
      } else {
        setStatus({ error: 'عذراً، لم يتم العثور على أي نسخة احتياطية سابقة مخزنة على سحابة فاير بيز الخاصة بك.' });
      }
    } catch (err: any) {
      console.error(err);
      setStatus({ error: `فشل تحميل البيانات السحابية: ${err.message || err}` });
    } finally {
      setSyncLoading(null);
      setTimeout(() => setStatus(null), 6000);
    }
  };

  const handleToggleFirebase = (val: boolean) => {
    dbEngine.setFirebaseEnabled(val);
    setFirebaseEnabled(val);
    if (val) {
      dbEngine.syncAllToFirebase().then(() => {
        setLastSync(new Date().toISOString());
        setStatus({ success: 'تم تفعيل الحفظ التلقائي السحابي ومزامنة البيانات المحلية الحالية فورا!' });
        setTimeout(() => setStatus(null), 4000);
      }).catch(err => {
        console.error(err);
      });
    }
  };

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
            <h4 className="font-bold text-red-750 text-sm">حذف وتصفير البيانات بالكامل</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold font-medium">حذف كافة البيانات التجريبية والعمليات الحالية والبدء بقاعدة بيانات فارغة تماماً لتسجيل طلابك الفعليين.</p>
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2.5 bg-red-50 text-red-655 border border-red-100 hover:bg-red-100 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-red-650" />
            حذف كافة البيانات والبدء من جديد
          </button>
        </div>
      </div>

      {/* Firebase Cloud Sync Control Panel */}
      <div className="bg-gradient-to-l from-slate-900 to-indigo-950 text-white p-6 md:p-8 rounded-2xl text-right space-y-6 shadow-xl border border-indigo-900 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-indigo-800/40 pb-5">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30">
              <Cloud className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h4 className="font-black text-base md:text-lg text-white">بوابة الربط والمزامنة السحابية مع Firebase</h4>
              <p className="text-indigo-200 text-xs mt-0.5 font-semibold">تأمين ومزامنة بيانات السنتر على حساب فاير بيز السحابي الخاص بك بشكل فوري وتلقائي</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowCustomConfigForm(!showCustomConfigForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700/50 rounded-xl text-xs font-bold transition text-indigo-200"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{showCustomConfigForm ? 'إخفاء الإعدادات الخاصة' : 'إعدادات Firebase الخاصة بي'}</span>
            </button>

            <div className="flex items-center gap-2.5 bg-slate-800/60 hover:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700 transition">
              <span className="text-xs font-bold text-slate-300">مزامنة تلقائية للمتصفح:</span>
              <button
                type="button"
                onClick={() => handleToggleFirebase(!firebaseEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  firebaseEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    firebaseEnabled ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Custom Firebase configuration form */}
        {showCustomConfigForm && (
          <div className="bg-slate-900/90 border border-indigo-500/30 p-5 rounded-xl space-y-4 text-xs font-semibold animate-in slide-in-from-top-2 duration-200">
            <div className="border-b border-slate-800 pb-3">
              <h5 className="text-sm font-bold text-indigo-300">ربط وتوصيل حساب Firebase الخاص بك (الحل لتخطي حدود الاستخدام)</h5>
              <p className="text-slate-400 text-[11px] mt-1">تجنب قيود الاستخدام السحابية المجانية لـ Firebase الافتراضي من خلال توصيل مشروعك الشخصي والمستقل على Firebase مجاناً.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-slate-300">ألصق كود تهيئة الـ Web App من Firebase Console لتعبئة الحقول تلقائياً:</label>
              <textarea
                value={pasteJsonText}
                onChange={(e) => handleParseJson(e.target.value)}
                placeholder='مثال: const firebaseConfig = { apiKey: "...", projectId: "..." };'
                dir="ltr"
                className="w-full h-20 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="block text-slate-400">API Key (مفتاح الـ API)*</label>
                <input
                  type="text"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  dir="ltr"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Project ID (معرف المشروع)*</label>
                <input
                  type="text"
                  value={customProjectId}
                  onChange={(e) => setCustomProjectId(e.target.value)}
                  dir="ltr"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Database ID (معرف قاعدة البيانات - اختياري)</label>
                <input
                  type="text"
                  value={customDatabaseId}
                  onChange={(e) => setCustomDatabaseId(e.target.value)}
                  placeholder="(default)"
                  dir="ltr"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Auth Domain (اختياري)</label>
                <input
                  type="text"
                  value={customAuthDomain}
                  onChange={(e) => setCustomAuthDomain(e.target.value)}
                  dir="ltr"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">Storage Bucket (اختياري)</label>
                <input
                  type="text"
                  value={customStorageBucket}
                  onChange={(e) => setCustomStorageBucket(e.target.value)}
                  dir="ltr"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400">App ID (اختياري)</label>
                <input
                  type="text"
                  value={customAppId}
                  onChange={(e) => setCustomAppId(e.target.value)}
                  dir="ltr"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3.5 pt-2 justify-end">
              {isCustomConfigUsed && (
                <button
                  type="button"
                  onClick={handleClearCustomConfig}
                  className="px-4 py-2 bg-red-950 hover:bg-red-900 border border-red-900/50 text-red-300 rounded-lg transition duration-150 font-bold"
                >
                  الرجوع للمشروع الافتراضي وإلغاء التخصيص
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveCustomConfig}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition duration-150 font-bold shadow-lg shadow-emerald-900/30"
              >
                حفظ الإعدادات وإعادة تشغيل الاتصال
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200 bg-indigo-950/50 p-3 rounded-xl border border-indigo-800/30 w-fit">
              <Database className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                نوع الاتصال السحابي:{' '}
                <strong className="text-white">
                  {isCustomConfigUsed ? 'مشروع مخصص الخاص بك' : 'مشروع السنتر الافتراضي المدمج'}
                </strong>
              </span>
            </div>

            <div className="text-xs text-indigo-150 leading-relaxed font-semibold space-y-1">
              <p>• عند تفعيل المزامنة التلقائية، سيقوم النظام بحفظ ورفع أي تغيير فوراً (مثل تسجيل حضور، دفع اشتراك، إضافة طالب) لسحابة Firebase.</p>
              <p>• يتيح لك ذلك ربط أجهزة متعددة (مثال: جهاز المعلم، تليفون السكرتارية، شاشة السنتر) ومتابعة البيانات في نفس اللحظة بكل أمان وسهولة.</p>
            </div>

            <p className="text-[11px] text-slate-400 font-bold">
              آخر مزامنة سحابية كاملة: <span className="text-indigo-300 font-mono">{lastSync.includes('T') ? new Date(lastSync).toLocaleString('ar-EG') : lastSync}</span>
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={handlePushToFirebase}
              disabled={syncLoading !== null}
              className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl flex-1 flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-700/20 active:scale-98 cursor-pointer"
            >
              {syncLoading === 'push' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              <span>رفع البيانات الحالية للسحابة</span>
            </button>

            <button
              type="button"
              onClick={handlePullFromFirebase}
              disabled={syncLoading !== null}
              className="py-3 px-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 border border-slate-700 font-extrabold text-xs rounded-xl flex-1 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
            >
              {syncLoading === 'pull' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span>تنزيل واستعادة البيانات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Password Management Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 mt-6 text-right space-y-4 shadow-xs">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <KeyRound className="w-5 h-5 text-blue-600" />
          <h4 className="font-bold text-slate-800 text-sm">تغيير الرمز السري لبوابة الطاقم الإداري</h4>
        </div>
        
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          الرمز السري الافتراضي لبوابة الطاقم الإداري هو <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-black">120</span> أو <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-black">admin</span>. يمكنك تعيين كود سري مخصص جديد لحماية خصوصية بيانات السنتر والمجموعات.
        </p>

        {(() => {
          const handlePasswordChange = (e: React.FormEvent) => {
            e.preventDefault();
            if (!newPassword.trim()) {
              setPwdStatus({ error: 'الرجاء إدخال كود سري جديد وصالح.' });
              return;
            }
            if (newPassword.trim() !== confirmPassword.trim()) {
              setPwdStatus({ error: 'عذراً، كلمة المرور الجديدة وتأكيدها غير متطابقتين.' });
              return;
            }
            localStorage.setItem('abuzekry_admin_password', newPassword.trim());
            setPwdStatus({ success: `تم حفظ وتفعيل الكود السري الجديد بنجاح! الرمز المعتمد الآن هو: ${newPassword.trim()}` });
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPwdStatus(null), 5000);
          };

          return (
            <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-4xl">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">الرمز السري الجديد *</label>
                <input
                  type="text"
                  required
                  placeholder="أدخل الرمز الجديد..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-bold outline-none transition text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">تأكيد الرمز السري الجديد *</label>
                <input
                  type="text"
                  required
                  placeholder="تأكيد الرمز الجديد..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-bold outline-none transition text-right"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-5 bg-blue-650 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                حفظ الكود السري الجديد
              </button>
            </form>
          );
        })()}

        {pwdStatus?.success && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse mt-2">
            <CheckCircle className="w-4 h-4" />
            <span>{pwdStatus.success}</span>
          </div>
        )}

        {pwdStatus?.error && (
          <div className="p-3 bg-red-50 text-red-755 border border-red-100 rounded-lg text-xs font-bold flex items-center gap-2 mt-2">
            <AlertOctagon className="w-4 h-4" />
            <span>{pwdStatus.error}</span>
          </div>
        )}
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
                تحذير أمان: حذف وتصفير قاعدة البيانات بالكامل
              </h3>
            </div>

            {/* Modal Content */}
            <div className="text-xs text-slate-600 leading-relaxed font-semibold space-y-3">
              <p className="text-slate-900 text-sm font-bold leading-relaxed">
                تنبيه هام جداً: سيؤدي هذا الإجراء إلى حذف كافة بيانات الطلاب والمجموعات والحسابات والدرجات والواجبات الحالية تماماً من المتصفح ومن السحابة!
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                سيتم تصفير البيانات بالكامل والبدء بقاعدة بيانات فارغة ونظيفة لتسجيل عملك الفعلي. نوصي بشدة بتحميل نسخة احتياطية أولاً قبل المتابعة.
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
