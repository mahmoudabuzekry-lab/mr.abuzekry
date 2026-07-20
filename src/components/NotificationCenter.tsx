import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Group, Student, GradeType } from '../types';
import { Bell, BellOff, Play, ShieldAlert, Sparkles, Clock, Check, Volume2 } from 'lucide-react';

interface NotificationCenterProps {
  groups: Group[];
  students: Student[];
  userRole: 'guest' | 'teacher' | 'parent' | 'student';
  onRefreshData: () => void;
}

interface AlertLog {
  id: string;
  title: string;
  body: string;
  time: string;
  type: 'registration' | 'schedule' | 'test' | 'system';
}

export default function NotificationCenter({ groups, students, userRole, onRefreshData }: NotificationCenterProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Synthesize a beautiful double-chime sound using Web Audio API
  const playNotificationSound = () => {
    if (isMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      // Tone 1: Soft warm note
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);

      // Tone 2: Shimmering higher note slightly offset
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880.00, ctx.currentTime); // A5 note
          gain2.gain.setValueAtTime(0.15, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.6);
        } catch (innerErr) {}
      }, 120);

    } catch (e) {
      console.warn('Audio Context sound synthesis failed or blocked by autoplay policy:', e);
    }
  };

  // Check if browser supports notifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'Notification' in window;
      setIsSupported(supported);
      if (supported) {
        setPermission(Notification.permission);
      }
    }
  }, []);

  // Request notifications permission
  const requestPermission = async () => {
    if (!isSupported) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        // Send welcoming notification with synthesized sound
        playNotificationSound();
        const notification = new Notification('🔔 تم تفعيل إشعارات الأستاذ محمود أبوذكري!', {
          body: 'ستصلك الآن تنبيهات حجز المقاعد ومواعيد الحصص اليومية على هاتفك فوراً.',
          icon: '/favicon.ico',
          tag: 'welcome-notification'
        });
        
        addLog('تفعيل الإشعارات', 'تم تفعيل إشعارات المتصفح والبيئة السحابية بنجاح على هذا الجهاز.', 'system');
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  };

  // Helper to add in-app logs
  const addLog = (title: string, body: string, type: AlertLog['type']) => {
    const newLog: AlertLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title,
      body,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type
    };
    setAlertLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep last 50 logs
  };

  // Trigger test notification
  const sendTestNotification = () => {
    if (!isSupported) return;
    
    if (permission !== 'granted') {
      requestPermission();
      return;
    }

    playNotificationSound();
    
    const options: NotificationOptions = {
      body: 'هذا إشعار تجريبي لاختبار وصول التنبيهات الفورية السحابية على جوالك بنجاح! 🔬🧪',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'test-notification',
      requireInteraction: true
    };

    new Notification('🧪 إشعار تجريبي ناجح!', options);
    addLog('إرسال إشعار تجريبي', 'تم فحص الإشعار والصوت بنجاح على جهازك الجوال/الحاسوب.', 'test');
  };

  // Real-time listener for public registrations (Firestore collection)
  useEffect(() => {
    if (userRole !== 'teacher' || !db) return;

    let isInitialLoad = true;
    const colRef = collection(db, 'abuzekry_public_registrations');

    // Subscribe to public registrations Firestore collection in real-time
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      // We skip the initial loaded snapshot documents to only alert on brand new additions
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const regData = change.doc.data();
          const studentName = regData.name || 'طالب جديد';
          const grade = regData.grade || 'غير محدد';
          
          // Sound and Native Push
          playNotificationSound();
          
          if (Notification.permission === 'granted') {
            new Notification('📝 تسجيل طالب جديد بالمنصة!', {
              body: `تقدم الطالب/ة "${studentName}" للتسجيل في "${grade}". يرجى الاعتماد المالي ومراجعة السجلات.`,
              icon: '/favicon.ico',
              tag: `reg-${change.doc.id}`,
              requireInteraction: true
            });
          }

          // Add in-app visible log
          addLog(
            '📝 طلب تسجيل جديد قيد الانتظار',
            `تقدم الطالب ${studentName} لصف (${grade}) وبانتظار اعتمادك.`,
            'registration'
          );

          // Automatically trigger parent page data refresh so lists update instantly in real time
          onRefreshData();
        }
      });
    }, (error) => {
      console.warn('Real-time notification snapshot error:', error);
    });

    return () => unsubscribe();
  }, [userRole, db]);

  // Today's schedule calculation and notifier helper
  const getArabicDayName = (): string => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayIndex = new Date().getDay();
    return days[dayIndex];
  };

  const alertTodayClasses = () => {
    const todayArabic = getArabicDayName();
    const todayGroups = groups.filter(g => {
      const cleanDay = g.day || '';
      return cleanDay.includes(todayArabic);
    });

    if (todayGroups.length > 0) {
      playNotificationSound();
      
      const groupTimes = todayGroups.map(g => `• ${g.name} (${g.time})`).join('\n');
      const bodyText = `لديك اليوم عدد (${todayGroups.length}) حصص مجدولة لمادة العلوم:\n${groupTimes}`;

      if (Notification.permission === 'granted') {
        new Notification('🗓️ جدول ومواعيد حصص اليوم', {
          body: `لديك اليوم عدد (${todayGroups.length}) مجموعات لمراجعة العلوم تبدأ من ${todayGroups[0].time}.`,
          icon: '/favicon.ico',
          tag: 'today-schedule'
        });
      }

      addLog('🗓️ كشف جدول حصص اليوم المعتمد', `لديك اليوم (${todayGroups.length}) مجموعات نشطة (${todayArabic}).`, 'schedule');
    } else {
      if (Notification.permission === 'granted') {
        new Notification('🌴 يوم راحة مجدول', {
          body: `لا توجد مجموعات حصص مجدولة لليوم (${todayArabic}). استمتع بوقتك!`,
          icon: '/favicon.ico',
          tag: 'today-schedule'
        });
      }
      addLog('🌴 يوم راحة مجدول', `لا توجد مجموعات حصص نشطة اليوم (${todayArabic}).`, 'schedule');
    }
  };

  // Trigger daily classes alert on dashboard load (once per day/session)
  useEffect(() => {
    if (userRole === 'teacher' && groups.length > 0) {
      const lastAlertDate = localStorage.getItem('abuzekry_last_schedule_alert_date');
      const todayDateStr = new Date().toDateString();
      
      if (lastAlertDate !== todayDateStr) {
        // Delay slightly for pleasant startup feel
        const timer = setTimeout(() => {
          alertTodayClasses();
          localStorage.setItem('abuzekry_last_schedule_alert_date', todayDateStr);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [userRole, groups]);

  if (userRole !== 'teacher') return null;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm text-right space-y-4 no-print animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-1">
          <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 justify-end">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <Bell className="w-5 h-5 text-indigo-600 shrink-0" />
            مركز التنبيهات السحابي والإشعارات الفورية
          </h4>
          <p className="text-slate-400 text-[11px]">نظام ذكي متكامل يعتمد على سحابة Firebase والـ Push API لإرسال إشعارات التسجيل والمواعيد</p>
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isMuted 
                ? 'bg-amber-50 border-amber-200 text-amber-700' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title={isMuted ? 'تفعيل صوت التنبيهات' : 'كتم صوت التنبيهات'}
          >
            <Volume2 className={`w-4 h-4 ${isMuted ? 'text-amber-500' : 'text-slate-500'}`} />
            <span className="text-[10px]">{isMuted ? 'صوت مكتوم' : 'صوت مفعل'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-bold text-slate-700 transition cursor-pointer"
          >
            {showSettings ? 'إخفاء لوحة التحكم' : 'إدارة الإعدادات'}
          </button>
        </div>
      </div>

      {/* Permission solicitation / Configuration Area */}
      {(showSettings || permission !== 'granted') && (
        <div className="bg-slate-50/70 border border-slate-200/60 p-4 rounded-2xl space-y-4 animate-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status indicators */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-150 flex items-center justify-between">
              <div className="text-right space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">إذن التنبيهات بالجهاز</span>
                <span className={`inline-flex items-center gap-1 text-xs font-extrabold ${
                  permission === 'granted' 
                    ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md' 
                    : permission === 'denied'
                    ? 'text-red-700 bg-red-50 px-2 py-0.5 rounded-md'
                    : 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md'
                }`}>
                  {permission === 'granted' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      مفعل ومسموح به ✅
                    </>
                  ) : permission === 'denied' ? (
                    <>
                      <ShieldAlert className="w-3 h-3 text-red-600" />
                      محظور من المتصفح ❌
                    </>
                  ) : (
                    'بانتظار الإذن 💬'
                  )}
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg text-slate-500">
                {permission === 'granted' ? <Bell className="w-5 h-5 text-emerald-600" /> : <BellOff className="w-5 h-5" />}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-col justify-center gap-2">
              {permission !== 'granted' ? (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  تفعيل الإشعارات على هذا الجوال / الجهاز 🔔
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={sendTestNotification}
                    className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 text-blue-400" />
                    إرسال إشعار تجريبي 🧪
                  </button>

                  <button
                    type="button"
                    onClick={alertTodayClasses}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Clock className="w-3.5 h-3.5 text-white" />
                    جدول حصص اليوم 🗓️
                  </button>
                </div>
              )}
            </div>
          </div>

          {permission === 'denied' && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-[10px] leading-relaxed font-bold flex items-start gap-2 text-right">
              <span className="text-base">⚠️</span>
              <div>
                <p className="font-black text-red-950 text-xs">قمت بحظر الإشعارات مسبقاً في هذا المتصفح!</p>
                <p className="text-red-700 mt-1 font-medium">لكي تستقبل إشعارات ومواعيد الأستاذ محمود على موبايلك، يرجى النقر على قفل الأمان بجانب عنوان الموقع في شريط البحث بالمتصفح، ثم قم بتغيير خيار الإشعارات (Notifications) إلى "سماح" (Allow).</p>
              </div>
            </div>
          )}

          {permission === 'default' && (
            <div className="p-3 bg-amber-50/60 border border-amber-100 text-amber-800 rounded-xl text-[10px] leading-relaxed font-medium text-right flex items-start gap-2">
              <span className="text-base">💡</span>
              <div>
                <p className="font-bold text-amber-950">خطوة بسيطة لتفعيل استقبال التنبيهات الفورية:</p>
                <p className="mt-1">يرجى الضغط على زر "تفعيل الإشعارات" بالأعلى، ثم النقر على "سماح" (Allow) في النافذة المنبثقة من متصفحك.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live notification feed of the current session */}
      <div className="space-y-3">
        <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 justify-end">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          سجل إشعارات وتنبيهات الجلسة الحالية
        </h5>

        <div className="bg-slate-50/50 rounded-2xl border border-slate-150 p-3 max-h-[160px] overflow-y-auto divide-y divide-slate-150/70 scrollbar-thin">
          {alertLogs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 italic text-[11px] font-medium">
              بانتظار تنبيهات حية... عند قيام طالب بالتسجيل الذاتي ستظهر لك التفاصيل وصوت الرنين هنا فوراً 📡🔔
            </div>
          ) : (
            alertLogs.map((log) => (
              <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-center text-[11px] animate-in slide-in-from-top-1 duration-150">
                <span className="font-mono text-slate-400 font-bold shrink-0">{log.time}</span>
                <div className="text-right space-y-0.5 pr-2 pl-3">
                  <div className="font-extrabold text-slate-800 flex items-center gap-1 justify-end">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      log.type === 'registration' 
                        ? 'bg-blue-500' 
                        : log.type === 'schedule' 
                        ? 'bg-emerald-500' 
                        : log.type === 'test' 
                        ? 'bg-indigo-500' 
                        : 'bg-slate-500'
                    }`} />
                    <span>{log.title}</span>
                  </div>
                  <p className="text-slate-500 leading-tight font-medium">{log.body}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
