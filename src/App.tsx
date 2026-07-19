/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { dbEngine } from './db';
import { Student, Group, Payment, Attendance, Exam, ExamScore, WhatsAppTemplate, GradeType, doesMonthPrecedeDate, getCurrentArabicMonthName, RegistrationSettings } from './types';
import StudentManager from './components/StudentManager';
import GroupsManager from './components/GroupsManager';
import AttendanceManager from './components/AttendanceManager';
import FinanceManager from './components/FinanceManager';
import ExamsManager from './components/ExamsManager';
import WhatsAppSender from './components/WhatsAppSender';
import DatabaseBackup from './components/DatabaseBackup';
import ReportsManager from './components/ReportsManager';
import WeeklyAttendancePlanner from './components/WeeklyAttendancePlanner';
import { QRCodeSVG } from 'qrcode.react';

// Icons
import { 
  Users, Calendar, CreditCard, Award, MessageSquare, Database, LogIn, Compass,
  BookOpen, LogOut, CheckCircle, Clock, Search, ShieldAlert, Award as AwardIcon, User, 
  MapPin, Phone, HelpCircle, GraduationCap, DollarSign, ListOrdered, CheckCircle2,
  Lock, Unlock, KeyRound, ShieldAlert as ShieldIcon,
  Cloud, CloudOff, RefreshCw, Wifi, WifiOff, TrendingUp
} from 'lucide-react';

export default function App() {
  // Database States
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examScores, setExamScores] = useState<ExamScore[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [prices, setPrices] = useState<Record<GradeType, number>>({} as any);
  const [registrationSettings, setRegistrationSettings] = useState<RegistrationSettings>({
    isGloballyEnabled: true,
    disabledGrades: []
  });

  // Authentication/Role State
  const [userRole, setUserRole] = useState<'guest' | 'teacher' | 'parent' | 'student'>(() => {
    return (localStorage.getItem('abuzekry_user_role') as any) || 'guest';
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [isPasswordError, setIsPasswordError] = useState(false);

  // Secret Authentication/Gate States
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [logoClicks, setLogoClicks] = useState(0);

  // Real Public Student Registration State
  const [showRegForm, setShowRegForm] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    phone: '',
    parentPhone: '',
    grade: 'الصف الثالث الإعدادي' as GradeType,
    school: '',
    address: '',
    groupId: '',
  });
  const [regSuccess, setRegSuccess] = useState(false);
  
  // Student Portal State
  const [studentCodeInput, setStudentCodeInput] = useState(() => {
    return localStorage.getItem('abuzekry_student_code_input') || '';
  });
  const [activePortalStudent, setActivePortalStudent] = useState<Student | null>(null);
  const [activePortalStudentError, setActivePortalStudentError] = useState(false);

  // Parent Portal State
  const [parentPhoneInput, setParentPhoneInput] = useState(() => {
    return localStorage.getItem('abuzekry_parent_phone_input') || '';
  });
  const [activePortalParentStudents, setActivePortalParentStudents] = useState<Student[]>([]);
  const [activePortalParentSearchDone, setActivePortalParentSearchDone] = useState(false);
  const [guestTab, setGuestTab] = useState<'parent' | 'student' | 'register'>('register');
  const [bannerError, setBannerError] = useState(false);

  // Active Teacher Panel Tab
  const [activeTeacherTab, setActiveTeacherTab] = useState<'dashboard' | 'students' | 'groups' | 'attendance' | 'finances' | 'exams' | 'weekly-planner' | 'whatsapp' | 'backup' | 'reports'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Duplicates Finder & Manager States
  const [selectedDuplicateGrade, setSelectedDuplicateGrade] = useState<GradeType>('الصف الرابع الابتدائي');
  const [editingDupStudent, setEditingDupStudent] = useState<Student | null>(null);
  const [deletingDupId, setDeletingDupId] = useState<string | null>(null);
  const [duplicateSuccessMsg, setDuplicateSuccessMsg] = useState<string | null>(null);
  const [showApprovedSiblings, setShowApprovedSiblings] = useState(false);

  // Background Auto-Sync state
  const [autoSyncState, setAutoSyncState] = useState<'idle' | 'checking' | 'syncing' | 'synced' | 'offline' | 'error'>('idle');
  const [autoSyncMessage, setAutoSyncMessage] = useState<string>('');

  // Load and refresh state from storage
  const loadDatabase = () => {
    dbEngine.init();
    setStudents(dbEngine.getStudents());
    setGroups(dbEngine.getGroups());
    setPayments(dbEngine.getPayments());
    setAttendance(dbEngine.getAttendance());
    setExams(dbEngine.getExams());
    setExamScores(dbEngine.getExamScores());
    setTemplates(dbEngine.getTemplates());
    setPrices(dbEngine.getPrices());
    setRegistrationSettings(dbEngine.getRegistrationSettings());
  };

  useEffect(() => {
    loadDatabase();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + A (Admin) or Ctrl + Shift + P (Passcode) opens secret login overlay
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setShowSecretModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Synchronize teacher active state with local database engine and persist role
  useEffect(() => {
    localStorage.setItem('abuzekry_user_role', userRole);
    dbEngine.setTeacherActive(userRole === 'teacher');
  }, [userRole]);

  // Re-link portal active records when student list or role changes
  useEffect(() => {
    if (userRole === 'student' && studentCodeInput) {
      const found = students.find(s => s.status === 'approved' && s.code.toLowerCase() === studentCodeInput.trim().toLowerCase());
      if (found) {
        setActivePortalStudent(found);
      }
    } else if (userRole === 'parent' && parentPhoneInput) {
      const found = students.filter(s => s.status === 'approved' && s.parentPhone.trim() === parentPhoneInput.trim());
      setActivePortalParentStudents(found);
      setActivePortalParentSearchDone(true);
    }
  }, [students, userRole, studentCodeInput, parentPhoneInput]);

  // Automatic background database synchronization with Firebase on startup/mount & user role change
  useEffect(() => {
    let active = true;

    const pullFromCloudOnStartup = async () => {
      if (!dbEngine.isFirebaseEnabled()) {
        setAutoSyncState('idle');
        return;
      }

      setAutoSyncState('checking');
      setAutoSyncMessage('جاري جلب أحدث البيانات من السحابة...');

      try {
        const { testConnection, fetchEntityFromFirebase } = await import('./firebase');
        const isOnline = await testConnection();

        if (!isOnline) {
          if (active) {
            setAutoSyncState('offline');
            setAutoSyncMessage('يعمل أوفلاين (بدون اتصال)');
            setTimeout(() => {
              if (active) setAutoSyncMessage('');
            }, 5000);
          }
          return;
        }

        if (active) {
          setAutoSyncState('syncing');
          setAutoSyncMessage('✨ جاري تطبيق السجلات السحابية على جهازك...');
        }

        // Fetch Admin Settings separately
        const cAdminSettings = await fetchEntityFromFirebase('admin_settings').catch(() => null);
        if (cAdminSettings && cAdminSettings.items && cAdminSettings.items.password) {
          localStorage.setItem('abuzekry_admin_password', cAdminSettings.items.password);
        }

        // Call the unified, safe syncAllFromFirebase method!
        const hasData = await dbEngine.syncAllFromFirebase();

        if (hasData) {
          loadDatabase();  // Update React active view states
        }

        // Automatically pull and import any public self-registrations if teacher is active
        if (userRole === 'teacher') {
          try {
            const { fetchPublicRegistrations, deletePublicRegistration } = await import('./firebase');
            const publicRegs = await fetchPublicRegistrations();
            if (publicRegs && publicRegs.length > 0) {
              console.log(`Found ${publicRegs.length} new public registrations! Importing...`);
              let currentStudents = dbEngine.getStudents();
              let changed = false;
              
              for (const reg of publicRegs) {
                const alreadyExists = currentStudents.some(s => s.phone === reg.phone && s.name === reg.name);
                if (!alreadyExists) {
                  const code = dbEngine.generateNextStudentCode(currentStudents);
                  const uniqueId = `s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                  
                  const newStudent = {
                    id: uniqueId,
                    code,
                    name: reg.name,
                    phone: reg.phone,
                    parentPhone: reg.parentPhone,
                    grade: reg.grade,
                    school: reg.school,
                    address: reg.address,
                    groupId: reg.groupId,
                    exemptionType: reg.exemptionType || 'none',
                    discountAmount: reg.discountAmount || 0,
                    notes: reg.notes || 'تسجيل إلكتروني ذاتي بانتظار الاعتماد المالي',
                    status: 'pending' as const,
                    createdAt: reg.createdAt || new Date().toISOString()
                  };
                  currentStudents.push(newStudent);
                  changed = true;
                }
                // Clean up the processed registration document in Firestore
                await deletePublicRegistration(reg._docId);
              }
              
              if (changed) {
                dbEngine.setStudents(currentStudents);
                loadDatabase();
              }
            }
          } catch (regErr) {
            console.error("Error importing registrations:", regErr);
          }
        }

        localStorage.setItem('abuzekry_last_firebase_sync', new Date().toISOString());

        if (active) {
          setAutoSyncState('synced');
          setAutoSyncMessage('✅ تم استيراد السجلات وتحديث جهازك بنجاح!');
          setTimeout(() => {
            if (active) setAutoSyncMessage('');
          }, 4000);
        }
      } catch (err: any) {
        console.warn("Pulling cloud data failed on startup/login:", err);
        if (active) {
          setAutoSyncState('error');
          setAutoSyncMessage('تعذر تحديث البيانات أو الحصة مستنفذة');
          setTimeout(() => {
            if (active) setAutoSyncMessage('');
          }, 6000);
        }
      }
    };

    pullFromCloudOnStartup();

    const handleOnline = () => {
      pullFromCloudOnStartup();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
    };
  }, [userRole]);

  // Listen to immediate operations sync events to show live feedback on any user operation
  useEffect(() => {
    let active = true;

    const handleSyncStarted = (e: any) => {
      if (!active) return;
      setAutoSyncState('syncing');
      setAutoSyncMessage('جاري مزامنة التعديلات سحابياً...');
    };

    const handleSyncProcessing = (e: any) => {
      if (!active) return;
      setAutoSyncState('syncing');
      const count = e.detail?.count || 1;
      setAutoSyncMessage(`جاري حفظ ${count} تعديلات سحابياً...`);
    };

    const handleSyncCompleted = () => {
      if (!active) return;
      setAutoSyncState('synced');
      setAutoSyncMessage('✨ تم حفظ ومزامنة التعديلات!');
      loadDatabase(); // refresh UI local states
      setTimeout(() => {
        if (active) setAutoSyncMessage('');
      }, 3500);
    };

    const handleSyncFailed = (e: any) => {
      if (!active) return;
      setAutoSyncState('offline');
      setAutoSyncMessage(e.detail?.message || 'تم الحفظ محلياً (أوفلاين)');
      setTimeout(() => {
        if (active) setAutoSyncMessage('');
      }, 5000);
    };

    const handleSyncStatusUpdated = () => {
      if (!active) return;
      loadDatabase(); // Keep react state fresh when queue resolves
    };

    window.addEventListener('abuzekry_sync_started', handleSyncStarted);
    window.addEventListener('abuzekry_sync_processing', handleSyncProcessing);
    window.addEventListener('abuzekry_sync_completed', handleSyncCompleted);
    window.addEventListener('abuzekry_sync_failed', handleSyncFailed);
    window.addEventListener('abuzekry_sync_status_updated', handleSyncStatusUpdated);

    return () => {
      active = false;
      window.removeEventListener('abuzekry_sync_started', handleSyncStarted);
      window.removeEventListener('abuzekry_sync_processing', handleSyncProcessing);
      window.removeEventListener('abuzekry_sync_completed', handleSyncCompleted);
      window.removeEventListener('abuzekry_sync_failed', handleSyncFailed);
      window.removeEventListener('abuzekry_sync_status_updated', handleSyncStatusUpdated);
    };
  }, []);

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowSecretModal(true);
        return 0; // reset
      }
      return next;
    });
  };

  const handleSecretLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const storedPass = localStorage.getItem('abuzekry_admin_password') || '120';
    const isCustomPass = storedPass !== '120' && storedPass !== 'admin';
    const isValid = isCustomPass 
      ? secretInput === storedPass
      : (secretInput === '120' || secretInput === 'admin');

    if (isValid) {
      setUserRole('teacher');
      setIsPasswordError(false);
      setSecretInput('');
      setShowSecretModal(false);
    } else {
      setIsPasswordError(true);
      // automatically clear error state after 2 seconds
      setTimeout(() => setIsPasswordError(false), 2050);
    }
  };

  const handlePublicRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name.trim()) return;

    // Use selected groupId, otherwise find first group of selected grade to initially link them (or leave empty if custom)
    const gradeGroups = groups.filter(g => g.grade === regForm.grade);
    const targetGroupId = regForm.groupId || (gradeGroups.length > 0 ? gradeGroups[0].id : '');

    const regData = {
      name: regForm.name.trim(),
      phone: regForm.phone.trim(),
      parentPhone: regForm.parentPhone.trim(),
      grade: regForm.grade,
      school: regForm.school.trim() || 'عامة',
      address: regForm.address.trim() || 'أسيوط',
      groupId: targetGroupId,
      exemptionType: 'none' as const,
      discountAmount: 0,
      notes: 'تسجيل إلكتروني ذاتي بانتظار الاعتماد المالي',
      status: 'pending' as const
    };

    if (dbEngine.isFirebaseEnabled()) {
      try {
        const { submitPublicRegistration } = await import('./firebase');
        await submitPublicRegistration(regData);
      } catch (err) {
        console.error("Public registration upload failed, falling back to local:", err);
        dbEngine.addStudent(regData);
      }
    } else {
      dbEngine.addStudent(regData);
    }

    setRegSuccess(true);
    setRegForm({
      name: '',
      phone: '',
      parentPhone: '',
      grade: 'الصف الثالث الإعدادي',
      school: '',
      address: '',
      groupId: ''
    });

    loadDatabase();
    setTimeout(() => {
      setRegSuccess(false);
      setShowRegForm(false);
    }, 4000);
  };

  // Pre-configured login shortcuts for demo experience
  const handleQuickParentLogin = (phone: string) => {
    setParentPhoneInput(phone);
    localStorage.setItem('abuzekry_parent_phone_input', phone);
    const found = dbEngine.getStudents().filter(s => s.status === 'approved' && s.parentPhone === phone);
    setActivePortalParentStudents(found);
    setActivePortalParentSearchDone(true);
    setUserRole('parent');
  };

  const handleQuickStudentLogin = (code: string) => {
    setStudentCodeInput(code);
    localStorage.setItem('abuzekry_student_code_input', code);
    const found = dbEngine.getStudents().find(s => s.status === 'approved' && s.code === code);
    if (found) {
      setActivePortalStudent(found);
      setActivePortalStudentError(false);
      setUserRole('student');
    }
  };

  const handleTeacherLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPass = localStorage.getItem('abuzekry_admin_password') || '120';
    const isCustomPass = storedPass !== '120' && storedPass !== 'admin';
    const isValid = isCustomPass 
      ? adminPassword === storedPass
      : (adminPassword === '120' || adminPassword === 'admin');

    if (isValid) {
      setUserRole('teacher');
      setIsPasswordError(false);
      setAdminPassword('');
    } else {
      setIsPasswordError(true);
    }
  };

  const handleStudentSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = studentCodeInput.trim();
    const found = students.find(s => s.status === 'approved' && s.code.toLowerCase() === cleanCode.toLowerCase());
    if (found) {
      setActivePortalStudent(found);
      setActivePortalStudentError(false);
      localStorage.setItem('abuzekry_student_code_input', cleanCode);
    } else {
      setActivePortalStudent(null);
      setActivePortalStudentError(true);
    }
  };

  const handleParentSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = parentPhoneInput.trim();
    const found = students.filter(s => s.status === 'approved' && s.parentPhone.trim() === cleanPhone);
    setActivePortalParentStudents(found);
    setActivePortalParentSearchDone(true);
    localStorage.setItem('abuzekry_parent_phone_input', cleanPhone);
  };

  const handleLogout = () => {
    setUserRole('guest');
    setActivePortalStudent(null);
    setActivePortalParentStudents([]);
    setActivePortalParentSearchDone(false);
    setStudentCodeInput('');
    setParentPhoneInput('');
    localStorage.removeItem('abuzekry_user_role');
    localStorage.removeItem('abuzekry_student_code_input');
    localStorage.removeItem('abuzekry_parent_phone_input');
  };

  // Dashboard calculations representing Mr. Mahmoud Abuzekry statistics
  const approvedStudentsCount = students.filter(s => s.status === 'approved').length;
  const pendingRequestsCount = students.filter(s => s.status === 'pending').length;
  const totalGroupsCount = groups.length;
  
  const currentMonthName = getCurrentArabicMonthName();
  const totalRevenueForMonth = payments
    .filter(p => p.month === currentMonthName)
    .reduce((acc, p) => acc + p.amountPaid, 0);

  const bestPerformingStudents = [...examScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const getDuplicateGroupsForGrade = (grade: GradeType) => {
    const gradeStudents = students.filter(s => s.grade === grade && s.status === 'approved' && !s.isSiblingApproved);
    
    const nameGroups: Record<string, Student[]> = {};
    const phoneGroups: Record<string, Student[]> = {};
    
    gradeStudents.forEach(s => {
      const normName = s.name.trim().replace(/\s+/g, ' ').toLowerCase();
      const normPhone = s.parentPhone.trim().replace(/\D/g, '');
      
      if (normName) {
        if (!nameGroups[normName]) nameGroups[normName] = [];
        nameGroups[normName].push(s);
      }
      
      if (normPhone && normPhone.length >= 8) {
        if (!phoneGroups[normPhone]) phoneGroups[normPhone] = [];
        phoneGroups[normPhone].push(s);
      }
    });
    
    const duplicateIds = new Set<string>();
    
    Object.values(nameGroups).forEach(group => {
      if (group.length > 1) {
        group.forEach(s => duplicateIds.add(s.id));
      }
    });
    
    Object.values(phoneGroups).forEach(group => {
      if (group.length > 1) {
        group.forEach(s => duplicateIds.add(s.id));
      }
    });
    
    const dups = gradeStudents.filter(s => duplicateIds.has(s.id));
    const finalGroups: Array<{
      key: string;
      reason: 'name' | 'phone' | 'both';
      students: Student[];
    }> = [];
    
    const processedIds = new Set<string>();
    
    dups.forEach(student => {
      if (processedIds.has(student.id)) return;
      
      const normName = student.name.trim().replace(/\s+/g, ' ').toLowerCase();
      const normPhone = student.parentPhone.trim().replace(/\D/g, '');
      
      const related = dups.filter(s => {
        const sName = s.name.trim().replace(/\s+/g, ' ').toLowerCase();
        const sPhone = s.parentPhone.trim().replace(/\D/g, '');
        
        const nameMatch = sName === normName;
        const phoneMatch = normPhone && sPhone && normPhone === sPhone;
        
        return nameMatch || phoneMatch;
      });
      
      if (related.length > 0) {
        related.forEach(s => processedIds.add(s.id));
        
        const uniqueNames = new Set(related.map(s => s.name.trim().replace(/\s+/g, ' ').toLowerCase()));
        const uniquePhones = new Set(related.map(s => s.parentPhone.trim().replace(/\D/g, '')));
        
        let reason: 'name' | 'phone' | 'both' = 'name';
        if (uniqueNames.size === 1 && uniquePhones.size === 1) reason = 'both';
        else if (uniqueNames.size > 1 && uniquePhones.size === 1) reason = 'phone';
        
        finalGroups.push({
          key: student.name,
          reason,
          students: related
        });
      }
    });
    
    return finalGroups;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] text-right" style={{ direction: 'rtl' }}>
      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-20">
        {/* Sleek top status & account controller - ONLY shown when logged in */}
        {userRole !== 'guest' && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-slate-200/80 p-4 rounded-3xl shadow-xs mb-6 no-print">
            <div className="flex items-center gap-3">
              <div className="bg-[#0f172a] text-white p-2 rounded-xl shadow-xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0f172a] leading-tight">منصة الأستاذ محمود أبوذكري</h2>
                <p className="text-[10px] text-slate-500">حساب: {userRole === 'teacher' ? 'موجه المادة (الأدمن)' : userRole === 'parent' ? 'بوابة ولي الأمر' : 'بوابة الطالب'}</p>
              </div>
            </div>

            {/* Cloud Sync Status Badge */}
            {dbEngine.isFirebaseEnabled() && autoSyncMessage && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all duration-300 shadow-xs ${
                autoSyncState === 'checking' || autoSyncState === 'syncing'
                  ? 'bg-blue-50/85 text-blue-800 border-blue-200/60 animate-pulse'
                  : autoSyncState === 'synced'
                  ? 'bg-emerald-50/85 text-emerald-800 border-emerald-200/60'
                  : autoSyncState === 'offline'
                  ? 'bg-amber-50/85 text-amber-850 border-amber-200/60'
                  : 'bg-red-50/85 text-red-800 border-red-200/60'
              }`}>
                {autoSyncState === 'checking' || autoSyncState === 'syncing' ? (
                  <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                ) : autoSyncState === 'synced' ? (
                  <Cloud className="w-3 h-3 text-emerald-600" />
                ) : autoSyncState === 'offline' ? (
                  <WifiOff className="w-3 h-3 text-amber-600" />
                ) : (
                  <CloudOff className="w-3 h-3 text-red-600" />
                )}
                <span>{autoSyncMessage}</span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all border border-rose-100/60 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج من الحساب
            </button>
          </div>
        )}
        
        {/* ========================================================= */}
        {/* GUEST MODE: ENTER / AUTH GATEWAY SCREEN                   */}
        {/* ========================================================= */}
        {userRole === 'guest' && (
          <div className="space-y-10 py-4 no-print animate-in fade-in duration-300">
            {/* Centered Professional Image Banner with 5-Click Staff entryway */}
            {!bannerError ? (
              <div 
                onClick={handleLogoClick}
                className="w-full max-w-5xl mx-auto overflow-hidden rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 border border-slate-200/60 bg-gradient-to-tr from-slate-50 to-indigo-50/30 cursor-pointer relative group"
              >
                <img 
                  src="/banner.png" 
                  alt="منصة دروس العلوم مع الأستاذ محمود أبوذكري" 
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-cover block select-none group-hover:scale-[1.01] transition-transform duration-700"
                  onError={() => {
                    console.log("Custom banner not loaded yet. Showing text hero statement fallback.");
                    setBannerError(true);
                  }}
                />
              </div>
            ) : null}

            {/* Center Hero statement - Shown as subtitle or fallback if banner fails to load */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
              {bannerError && (
                <div 
                  onClick={handleLogoClick}
                  className="cursor-pointer select-none border border-dashed border-indigo-200/60 p-6 rounded-3xl bg-indigo-50/10 hover:bg-indigo-50/30 transition-all duration-300"
                >
                  <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                    منصة دروس العلوم
                  </h1>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-indigo-600">
                    للأستاذ محمود أبوذكري
                  </h2>
                </div>
              )}
              <div className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-5 py-2.5 rounded-full text-xs md:text-sm font-extrabold border border-emerald-200/80 transition shadow-sm">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                <span>للتواصل والاستفسار عبر الواتساب:</span>
                <a href="https://wa.me/201110335245" target="_blank" rel="noreferrer" className="hover:underline tracking-wider font-mono font-black text-sm text-emerald-700">01110335245</a>
              </div>
            </div>

            {/* Centered Premium Interactive Access & Registration Hub */}
            <div className="max-w-3xl mx-auto bg-white rounded-3xl border-2 border-slate-150/80 shadow-2xl overflow-hidden">
              {/* Custom Elegant Tab Switcher */}
              <div className="flex border-b border-slate-100 bg-slate-50/70 p-2.5 gap-2">
                <button
                  type="button"
                  onClick={() => setGuestTab('register')}
                  className={`flex-1 py-4 px-6 rounded-2xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer relative ${
                    guestTab === 'register'
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-xl shadow-amber-500/30 border-2 border-amber-300 scale-[1.04] z-10'
                      : 'bg-amber-50/90 text-amber-950 border-2 border-dashed border-amber-300/80 hover:bg-amber-100/90 hover:border-amber-400 hover:scale-[1.02] shadow-xs animate-pulse duration-1000'
                  }`}
                >
                  <span className="absolute -top-2.5 -left-2 bg-red-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md animate-bounce select-none z-20">
                    متاح الآن 🔥
                  </span>
                  <BookOpen className={`w-5 h-5 ${guestTab === 'register' ? 'text-white' : 'text-amber-600'}`} />
                  <span>تسجيل جديد بالمنصة (التسجيل الذاتي)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGuestTab('parent')}
                  className={`flex-1 py-4 px-6 rounded-2xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                    guestTab === 'parent'
                      ? 'bg-white text-emerald-800 shadow-md border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                  }`}
                >
                  <Users className={`w-5 h-5 ${guestTab === 'parent' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>بوابة ولي الأمر</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGuestTab('student')}
                  className={`flex-1 py-4 px-6 rounded-2xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                    guestTab === 'student'
                      ? 'bg-white text-indigo-800 shadow-md border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                  }`}
                >
                  <GraduationCap className={`w-5 h-5 ${guestTab === 'student' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>بوابة الطالب</span>
                </button>
              </div>

              {/* Tab Forms Body */}
              <div className="p-8 md:p-12 space-y-8">
                
                {/* TAB 1: PARENT PORTAL */}
                {guestTab === 'parent' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="space-y-2 text-right">
                      <h3 className="text-xl md:text-2xl font-black text-slate-900">الاستعلام والمتابعة لأولياء الأمور</h3>
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
                        يرجى إدخال رقم الهاتف المسجل لولي الأمر لمتابعة غياب وحضور الأبناء، والاطلاع على نتائج اختبارات العلوم والتقارير الدورية والمستحقات المالية بشكل فوري.
                      </p>
                    </div>

                    <form onSubmit={handleParentSearchSubmit} className="space-y-4">
                      <div className="relative">
                        <input
                          type="tel"
                          required
                          placeholder="أدخل رقم هاتف ولي الأمر المعتمد (مثال: 01198765432)"
                          value={parentPhoneInput}
                          onChange={(e) => setParentPhoneInput(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-sm md:text-base font-bold outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono placeholder:text-slate-400"
                        />
                      </div>

                      <button
                        type="submit"
                        onClick={() => setUserRole('parent')}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm md:text-base font-black transition-all shadow-lg shadow-emerald-600/20 hover:shadow-xl active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer"
                      >
                        <Users className="w-5 h-5" />
                        <span>دخول بوابة ولي الأمر ومتابعة الأداء</span>
                      </button>
                    </form>

                    {/* Parent Tips / Quick Hints */}
                    <div className="bg-emerald-50/50 text-emerald-950 p-4 rounded-2xl text-xs leading-relaxed border border-emerald-100/60 font-medium">
                      💡 <span className="font-extrabold text-emerald-800">تنبيه مهم:</span> لضمان فتح ملف أبنائك، يرجى استخدام رقم الموبايل الشخصي لولي الأمر الذي قمت بتسجيله مسبقاً في استمارة المركز لدى الأستاذ محمود.
                    </div>
                  </div>
                )}

                {/* TAB 2: STUDENT PORTAL */}
                {guestTab === 'student' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="space-y-2 text-right">
                      <h3 className="text-xl md:text-2xl font-black text-slate-900">البوابة الإلكترونية الذكية للمتعلم</h3>
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
                        أدخل كود الطالب الخاص بك المطبوع على كارت الباركود (مثال: S-1001) للاطلاع على مواعيد مجموعتك ومراجعة أوراق اختبارات العلوم واستخراج كارت الحضور الرقمي.
                      </p>
                    </div>

                    <form onSubmit={handleStudentSearchSubmit} className="space-y-4">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="أدخل كود المتعلم المكون من حرف S ورقم (مثال: S-1001)"
                          value={studentCodeInput}
                          onChange={(e) => setStudentCodeInput(e.target.value)}
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-sm md:text-base font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono placeholder:text-slate-400"
                        />
                      </div>

                      <button
                        type="submit"
                        onClick={() => setUserRole('student')}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm md:text-base font-black transition-all shadow-lg shadow-indigo-600/20 hover:shadow-xl active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer"
                      >
                        <GraduationCap className="w-5 h-5" />
                        <span>دخول البوابة ومطالعة الملف التعليمي</span>
                      </button>
                    </form>

                    {/* Student Tips / Quick Hints */}
                    <div className="bg-indigo-50/50 text-indigo-950 p-4 rounded-2xl text-xs leading-relaxed border border-indigo-100/60 font-medium">
                      🔑 <span className="font-extrabold text-indigo-800">هل تواجه مشكلة في معرفة كودك؟</span> كودك الفريد مدوّن على الكارت الذكي المطبوع، وفي حال فقدانه يرجى مراجعة سكرتارية الدرس فوراً لإملائه لك.
                    </div>
                  </div>
                )}

                {/* TAB 3: NEW REGISTRATION FORM */}
                {guestTab === 'register' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="space-y-2 text-right pb-3 border-b border-slate-100">
                      <h3 className="text-xl md:text-2xl font-black text-slate-900">استمارة الحجز والتقديم الإلكتروني</h3>
                      <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium">
                        سجل بياناتك الشخصية والدراسية بدقة وموثوقية لتأمين حجز مقعدك في مجموعات العلوم للأستاذ محمود أبوذكري. سيقوم النظام بحفظ الطلب فوراً لاعتماده وتوزيع المجموعة.
                      </p>
                    </div>

                    {!registrationSettings.isGloballyEnabled ? (
                      <div className="p-8 bg-amber-50/40 border-2 border-dashed border-amber-200 rounded-3xl text-center space-y-4 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-3xl">
                          🔒
                        </div>
                        <h4 className="text-xl font-black text-amber-950">التسجيل الإلكتروني مغلق حالياً</h4>
                        <p className="text-sm text-amber-800 leading-relaxed max-w-md mx-auto font-medium">
                          عذراً، التقديم الإلكتروني وحجز المجموعات مغلق حالياً بالكامل لجميع المراحل بقرار من إدارة الأستاذ محمود أبوذكري. يرجى التواصل مع السكرتارية أو المحاولة في وقت لاحق.
                        </p>
                        <div className="inline-flex items-center gap-2 bg-white px-5 py-2.5 rounded-full text-xs font-extrabold border border-amber-200 text-slate-850 shadow-sm">
                          <span>للتواصل عبر الواتساب:</span>
                          <a href="https://wa.me/201110335245" target="_blank" rel="noreferrer" className="hover:underline tracking-wider font-mono font-black text-amber-700">01110335245</a>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handlePublicRegisterSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 mb-2">اسم الطالب رباعي باللغة العربية *</label>
                            <input
                              type="text"
                              required
                              placeholder="أدخل الاسم رباعي بوضوح تام..."
                              value={regForm.name}
                              onChange={(e) => setRegForm({...regForm, name: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 mb-2">الصف الدراسي الحالي *</label>
                            <select
                              value={regForm.grade}
                              onChange={(e) => {
                                const newGrade = e.target.value as any;
                                const gradeGroups = groups.filter(g => g.grade === newGrade);
                                setRegForm({
                                  ...regForm,
                                  grade: newGrade,
                                  groupId: gradeGroups.length > 0 ? gradeGroups[0].id : ''
                                });
                              }}
                              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition font-sans"
                            >
                              <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                              <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                              <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                              <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                              <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                              <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                            </select>
                            {registrationSettings.disabledGrades?.includes(regForm.grade) && (
                              <p className="text-xs text-red-600 font-extrabold mt-2 flex items-center gap-1.5 animate-pulse bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg">
                                <span>⚠️ باب التسجيل مغلق حالياً لطلاب هذا الصف بقرار من الإدارة.</span>
                              </p>
                            )}
                          </div>
                        </div>

                      {/* Available Groups Selection Based on Selected Grade */}
                      {(() => {
                        const availableGroups = groups.filter(g => g.grade === regForm.grade);
                        return (
                          <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            <label className="block text-xs font-extrabold text-slate-700 mb-1">المجموعة التعليمية المتاحة لمواعيدك *</label>
                            {availableGroups.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableGroups.map((group) => {
                                  const isSelected = regForm.groupId === group.id || (!regForm.groupId && availableGroups[0].id === group.id);
                                  return (
                                    <div
                                      key={group.id}
                                      onClick={() => setRegForm({ ...regForm, groupId: group.id })}
                                      className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer flex items-start gap-3 select-none ${
                                        isSelected
                                          ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/5'
                                          : 'border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300'
                                      }`}
                                    >
                                      <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                        isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                                      }`}>
                                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                      <div className="space-y-1">
                                        <div className="font-extrabold text-xs text-slate-800">{group.name}</div>
                                        <div className="text-[10px] text-slate-500 font-bold flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">🗓️ {group.day}</span>
                                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">⏰ {group.time}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium">📍 {group.location}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-4 bg-amber-50/50 text-amber-800 border border-amber-100/60 rounded-xl text-xs font-bold text-center">
                                ⚠️ لا توجد مجموعات مجدولة حالياً لهذا الصف على النظام. يرجى المتابعة وسيقوم المعلم بتنسيق موعد مناسب وتوزيعك يدوياً.
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-2">رقم هاتف الطالب الشخصي (واتساب) *</label>
                          <input
                            type="tel"
                            required
                            placeholder="رقم الموبايل الشخصي النشط..."
                            value={regForm.phone}
                            onChange={(e) => setRegForm({...regForm, phone: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold font-mono outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-extrabold text-slate-700 mb-2 flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                            <span>رقم هاتف ولي الأمر / الوالد *</span>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md font-bold border border-emerald-100/60 inline-flex items-center gap-1 self-start xs:self-auto">
                              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              يجب أن يكون عليه واتساب نشط لضمان وصول الإشعارات 💬
                            </span>
                          </label>
                          <input
                            type="tel"
                            required
                            placeholder="موبايل الوالد (عليه واتساب فعال)..."
                            value={regForm.parentPhone}
                            onChange={(e) => setRegForm({...regForm, parentPhone: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold font-mono outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-2">اسم المدرسة الحالية</label>
                          <input
                            type="text"
                            placeholder="اسم المدرسة..."
                            value={regForm.school}
                            onChange={(e) => setRegForm({...regForm, school: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-2">العنوان / منطقة السكن الحالية</label>
                          <input
                            type="text"
                            placeholder="الحي السكني أو المدينة الحالية..."
                            value={regForm.address}
                            onChange={(e) => setRegForm({...regForm, address: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition"
                          />
                        </div>
                      </div>

                      {regSuccess && (
                        <div className="p-4 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-2xl text-xs md:text-sm font-bold text-center leading-relaxed flex items-center justify-center gap-2.5 animate-bounce">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span>تم إرسال طلب انضمامك وحجز المقعد بنجاح! الإدارة ستقوم بمراجعته وتفعيل ملفك خلال ساعات.</span>
                        </div>
                      )}

                      <div className="flex justify-end pt-3">
                        <button
                          type="submit"
                          disabled={regSuccess || registrationSettings.disabledGrades?.includes(regForm.grade)}
                          className="w-full sm:w-auto px-10 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <BookOpen className="w-5 h-5" />
                          <span>إرسال طلب الانضمام الإلكتروني للدرس</span>
                        </button>
                      </div>
                    </form>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TEACHER (ADMIN) WORKSPACE                                 */}
        {/* ========================================================= */}
        {userRole === 'teacher' && (
          <div className="flex flex-col lg:flex-row gap-6 print:block print:w-full relative items-start">
            
            {/* Sidebar Navigation */}
            <aside className={`bg-[#0f172a] text-white rounded-3xl transition-all duration-300 shadow-xl no-print shrink-0 flex flex-col w-full ${
              isSidebarCollapsed ? 'lg:w-20 p-4 space-y-3' : 'lg:w-72 p-5 space-y-4'
            }`}>
              <div className={`border-b border-slate-800 pb-3 flex items-center justify-between font-sans ${isSidebarCollapsed ? 'lg:flex-col lg:gap-2' : ''}`}>
                <div className="text-right flex items-center gap-2">
                  <div className="bg-blue-600/25 p-1.5 rounded-lg text-blue-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div>
                      <h3 className="font-bold text-white text-xs leading-none">لوحة إدارة الأستاذ محمود</h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-none">دفاتر ومستويات السنتر</p>
                    </div>
                  )}
                </div>
                
                {/* Collapse Button (Desktop Only) */}
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="hidden lg:flex p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-all items-center justify-center self-center"
                  title={isSidebarCollapsed ? "توسيع القائمة" : "طي القائمة"}
                >
                  <ListOrdered className="w-4 h-4 transform rotate-180 text-slate-400" />
                </button>
              </div>

              {/* Navigation Items: displayed in 2 horizontal rows on mobile, vertical column on desktop */}
              <nav className="grid grid-rows-2 grid-flow-col lg:flex lg:flex-col gap-2 lg:gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none whitespace-nowrap lg:whitespace-normal">
                <button
                  onClick={() => setActiveTeacherTab('dashboard')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'dashboard' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="اللوحة الإرشادية الكلية"
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-4 h-4 shrink-0 text-blue-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>اللوحة الإرشادية الكلية</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('students')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'students' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="المتعلمين والطلبات الجديدة"
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>المتعلمين والطلبات الجديدة</span>
                  </span>
                  {pendingRequestsCount > 0 && (
                    <span className={`text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-sans font-extrabold shrink-0 ${
                      isSidebarCollapsed ? 'lg:absolute lg:top-1.5 lg:left-1.5 lg:translate-x-1/2 lg:-translate-y-1/2 lg:w-4.5 lg:h-4.5 lg:p-0 lg:flex lg:items-center lg:justify-center lg:text-[9px]' : 'mr-2'
                    }`}>{pendingRequestsCount}</span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTeacherTab('groups')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'groups' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="جدول وحجوزات المجموعات"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>جدول وحجوزات المجموعات</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('attendance')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'attendance' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="رصد التحضير والغياب الذكي"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0 text-indigo-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>رصد التحضير والغياب الذكي</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('weekly-planner')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'weekly-planner' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="تنظيم أيام الحضور الأسبوعية"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 shrink-0 text-violet-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>تنظيم أيام الحضور الأسبوعية 🔄</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('finances')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'finances' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="المصروفات ودفتر الحسابات"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 shrink-0 text-cyan-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>المصروفات ودفتر الحسابات</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('exams')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'exams' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="الاختبارات ورصد الدرجات"
                >
                  <span className="flex items-center gap-2">
                    <Award className="w-4 h-4 shrink-0 text-rose-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>الاختبارات ورصد الدرجات</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('whatsapp')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'whatsapp' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="تهيئات قوالب WhatsApp"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 shrink-0 text-teal-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>تهيئات قوالب WhatsApp</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('reports')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'reports' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="قسم التقارير والتحليلات"
                >
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 shrink-0 text-purple-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>قسم التقارير والتحليلات</span>
                  </span>
                </button>

                <button
                  onClick={() => setActiveTeacherTab('backup')}
                  className={`relative py-2 px-3 text-xs font-semibold rounded-xl text-right flex items-center transition-all cursor-pointer ${
                    isSidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
                  } ${
                    activeTeacherTab === 'backup' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="النسخ الاحتياطي والصيانة"
                >
                  <span className="flex items-center gap-2">
                    <Database className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>النسخ الاحتياطي والصيانة</span>
                  </span>
                </button>
              </nav>

              {!isSidebarCollapsed && (
                <div className="pt-4 border-t border-slate-800 text-center hidden lg:block">
                  <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider block">
                    نظام الأستاذ محمود أبوذكري v1.0.0
                  </span>
                </div>
              )}
            </aside>

            {/* Layout Content wrapper */}
            <div className="flex-1 w-full space-y-6 print:block print:w-full overflow-hidden">
              
              {/* PANEL TAB 1: DASHBOARD STATS */}
              {activeTeacherTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Main greetings Statement */}
                  <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 md:p-8 space-y-3 relative overflow-hidden shadow-sm">
                    <div className="relative z-10 max-w-2xl space-y-2">
                      <span className="text-xs bg-white/10 text-slate-200 px-2.5 py-1 rounded-full font-bold">لوحة القيادة والمتابعة</span>
                      <h3 className="text-2xl font-bold font-sans leading-tight">مرحباً بك يا أستاذ محمود أبوذكري! 👨‍🏫</h3>
                      <p className="text-slate-300 text-xs font-medium leading-relaxed">
                        هذه اللوحة الموحدة تمنحك إحصائيات متكاملة فلكية وفورية لجميع مجموعات العلوم لصفوف الابتدائي والإعدادي المعتمدة بالسجلات.
                      </p>
                    </div>
                  </div>

                  {/* Grid metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400">الطلاب المسجلين</p>
                        <h4 className="text-2xl font-black text-slate-800 mt-1">{approvedStudentsCount} طالب</h4>
                      </div>
                      <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl"><Users className="w-5 h-5" /></div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400">مجموع المجموعات</p>
                        <h4 className="text-2xl font-black text-slate-800 mt-1">{totalGroupsCount} مجموعة</h4>
                      </div>
                      <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl"><Calendar className="w-5 h-5" /></div>
                    </div>

                    <button
                      onClick={() => setActiveTeacherTab('students')}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-500 hover:shadow-md text-right transition cursor-pointer"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-400">طلبات انتظار الاعتماد</p>
                        <h4 className="text-2xl font-black text-amber-655 text-amber-600 mt-1">{pendingRequestsCount} طالب</h4>
                      </div>
                      <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl"><HelpCircle className="w-5 h-5" /></div>
                    </button>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400">مقبوضات الشهر ({currentMonthName.split(' ')[0]})</p>
                        <h4 className="text-2xl font-black text-emerald-600 mt-1">{totalRevenueForMonth} ج.م</h4>
                      </div>
                      <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl"><DollarSign className="w-5 h-5" /></div>
                    </div>
                  </div>

                  {/* BRAND NEW SECTION 1: STUDENT COUNTS PER GRADE (أعداد طلاب كل صف على حدة) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm text-right">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 justify-end">
                          <GraduationCap className="w-5 h-5 text-indigo-600" />
                          توزيع الطلاب المعتمدين حسب الصفوف الدراسية
                        </h4>
                        <p className="text-slate-400 text-[11px] mt-0.5">انقر على أي صف لمراجعة كاشف ومعالج الحسابات المكررة له مباشرة بالأسفل</p>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold self-start">إحصاء كلي دقيق</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      {(['الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي', 'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'] as GradeType[]).map((grade) => {
                        const count = students.filter(s => s.grade === grade && s.status === 'approved').length;
                        const grpCount = groups.filter(g => g.grade === grade).length;
                        const isSelected = selectedDuplicateGrade === grade;
                        
                        // Configuration for grade color and background
                        const gradeCardConfigs: Record<GradeType, { bg: string; border: string; badgeBg: string; textBadge: string; textColor: string }> = {
                          'الصف الرابع الابتدائي': { bg: 'bg-indigo-50/30', border: 'border-indigo-150', badgeBg: 'bg-indigo-100/60', textBadge: 'text-indigo-700', textColor: 'text-indigo-900' },
                          'الصف الخامس الابتدائي': { bg: 'bg-emerald-50/30', border: 'border-emerald-150', badgeBg: 'bg-emerald-100/60', textBadge: 'text-emerald-700', textColor: 'text-emerald-900' },
                          'الصف السادس الابتدائي': { bg: 'bg-sky-50/30', border: 'border-sky-150', badgeBg: 'bg-sky-100/60', textBadge: 'text-sky-700', textColor: 'text-sky-900' },
                          'الصف الأول الإعدادي': { bg: 'bg-violet-50/30', border: 'border-violet-150', badgeBg: 'bg-violet-100/60', textBadge: 'text-violet-700', textColor: 'text-violet-900' },
                          'الصف الثاني الإعدادي': { bg: 'bg-amber-50/30', border: 'border-amber-150', badgeBg: 'bg-amber-100/60', textBadge: 'text-amber-700', textColor: 'text-amber-900' },
                          'الصف الثالث الإعدادي': { bg: 'bg-rose-50/30', border: 'border-rose-150', badgeBg: 'bg-rose-100/60', textBadge: 'text-rose-700', textColor: 'text-rose-900' }
                        };
                        const cfg = gradeCardConfigs[grade] || gradeCardConfigs['الصف الرابع الابتدائي'];

                        return (
                          <button
                            key={grade}
                            onClick={() => {
                              setSelectedDuplicateGrade(grade);
                              document.getElementById('duplicate-finder-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`p-4 rounded-xl text-right border transition-all cursor-pointer ${cfg.bg} ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md' : `${cfg.border} hover:shadow-xs hover:border-slate-300`}`}
                          >
                            <h5 className="font-bold text-xs text-slate-700 leading-tight truncate">{grade.replace('الصف ', '')}</h5>
                            <div className="mt-3 flex items-baseline gap-1 justify-end">
                              <span className="text-xl font-black text-slate-800">{count}</span>
                              <span className="text-[10px] text-slate-400 font-bold">طالب</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${cfg.badgeBg} ${cfg.textBadge}`}>
                                {grpCount} مجموعات
                              </span>
                              {isSelected && (
                                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* BRAND NEW SECTION 2: DUPLICATE STUDENTS FINDER & MANAGER (كاشف ومعالج الحسابات المكررة) */}
                  <div id="duplicate-finder-section" className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm text-right">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 justify-end">
                          <ShieldIcon className="w-5 h-5 text-rose-500 animate-pulse" />
                          مستكشف ومعالج الحسابات المكررة بالصف
                        </h4>
                        <p className="text-slate-400 text-[11px] mt-0.5">يكتشف تلقائياً الطلاب الذين يمتلكون نفس الاسم أو نفس هاتف ولي الأمر لتنظيف وتعديل البيانات فوراً</p>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs font-bold text-slate-650 shrink-0">الصف المستهدف:</span>
                        <select
                          value={selectedDuplicateGrade}
                          onChange={(e) => setSelectedDuplicateGrade(e.target.value as GradeType)}
                          className="p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-800 text-right"
                        >
                          {(['الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي', 'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'] as GradeType[]).map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {duplicateSuccessMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-855 text-emerald-800 rounded-xl text-xs font-bold text-center animate-in fade-in slide-in-from-top-1">
                        {duplicateSuccessMsg}
                      </div>
                    )}

                    {/* Duplicate matches logic */}
                    {getDuplicateGroupsForGrade(selectedDuplicateGrade).length === 0 ? (
                      <div className="text-center py-10 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 animate-in fade-in duration-350">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl shadow-xs">🎉</div>
                        <div>
                          <p className="text-slate-700 font-bold text-xs">سجلات الصف نظيفة تماماً!</p>
                          <p className="text-slate-400 text-[10px] mt-1">لا توجد حسابات مكررة بالاسم أو رقم الهاتف في {selectedDuplicateGrade}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-rose-600 font-bold flex items-center gap-1 justify-end">
                          <span>تم العثور على ({getDuplicateGroupsForGrade(selectedDuplicateGrade).length}) مجموعات تكرار محتملة بحاجة لاتخاذ إجراء:</span>
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-ping" />
                        </p>

                        <div className="grid grid-cols-1 gap-4">
                          {getDuplicateGroupsForGrade(selectedDuplicateGrade).map((group, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-3">
                              <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
                                  {group.reason === 'both' ? 'تطابق الاسم والهاتف ⚠️' : group.reason === 'phone' ? 'تطابق رقم هاتف ولي الأمر 📱' : 'تطابق الاسم الثنائي/الثلاثي 👤'}
                                </span>
                                <h5 className="font-extrabold text-xs text-slate-850">مجموعة التطابق: <strong className="text-slate-900">{group.key}</strong></h5>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {group.students.map((dupStudent) => {
                                  const grp = groups.find(g => g.id === dupStudent.groupId);
                                  const isDeleting = deletingDupId === dupStudent.id;
                                  
                                  // Sibling detection logic (same parentPhone but different student ID)
                                  const cleanDupPhone = dupStudent.parentPhone.trim().replace(/\D/g, '');
                                  const siblings = students.filter(s => 
                                    s.id !== dupStudent.id && 
                                    s.parentPhone && 
                                    s.parentPhone.trim().replace(/\D/g, '') === cleanDupPhone
                                  );

                                  return (
                                    <div key={dupStudent.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs relative hover:shadow-sm transition text-right flex flex-col justify-between">
                                      {/* Header Info */}
                                      <div className="space-y-2 text-right">
                                        <div className="flex justify-between items-start">
                                          <span className="font-mono font-bold text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                                            كود: {dupStudent.code}
                                          </span>
                                          <h6 className="font-extrabold text-xs text-slate-800">{dupStudent.name}</h6>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                                          <div>
                                            <span className="text-slate-400">رقم ولي الأمر:</span>
                                            <span className="font-mono font-bold text-slate-700 block mt-0.5">{dupStudent.parentPhone}</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">المجموعة الحالية:</span>
                                            <span className="font-bold text-slate-700 block mt-0.5 text-blue-650">{grp?.name || 'غير محددة'}</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">المدرسة:</span>
                                            <span className="font-medium text-slate-700 block mt-0.5 truncate">{dupStudent.school || '—'}</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400">تاريخ التسجيل:</span>
                                            <span className="font-mono text-slate-700 block mt-0.5">{dupStudent.createdAt ? dupStudent.createdAt.split('T')[0] : '—'}</span>
                                          </div>
                                        </div>

                                        {/* Sibling Detection Info */}
                                        {siblings.length > 0 && (
                                          <div className="mt-3 p-2.5 bg-indigo-50/55 border border-indigo-100 rounded-lg text-[10px] text-right space-y-1">
                                            <div className="font-bold text-indigo-900 flex items-center gap-1 justify-end">
                                              <span>نظام كشف الإخوة الذكي:</span>
                                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                            </div>
                                            <div className="space-y-0.5 text-slate-700 font-medium">
                                              {siblings.map(sib => (
                                                <div key={sib.id} className="flex justify-between items-center gap-2">
                                                  <span className="font-bold text-indigo-700">({sib.grade === dupStudent.grade ? 'نفس الصف' : sib.grade})</span>
                                                  <span>• {sib.name}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Action buttons inside student cards */}
                                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                                        {/* Direct group transfer dropdown */}
                                        <div className="flex items-center gap-1 text-[10px]">
                                          <span className="text-slate-400 font-bold shrink-0">نقل لمجموعة:</span>
                                          <select
                                            value={dupStudent.groupId}
                                            onChange={(e) => {
                                              const updated = { ...dupStudent, groupId: e.target.value };
                                              dbEngine.updateStudent(updated);
                                              loadDatabase();
                                              setDuplicateSuccessMsg(`تم نقل الطالب ${dupStudent.name} إلى المجموعة بنجاح 🎉`);
                                              setTimeout(() => setDuplicateSuccessMsg(null), 3500);
                                            }}
                                            className="p-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-700 cursor-pointer max-w-[120px] truncate"
                                          >
                                            {groups.filter(g => g.grade === selectedDuplicateGrade).map(g => (
                                              <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Edit / Delete controllers */}
                                        <div className="flex gap-1.5 justify-end">
                                          {isDeleting ? (
                                            <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
                                              <button
                                                onClick={() => {
                                                  dbEngine.deleteStudent(dupStudent.id);
                                                  loadDatabase();
                                                  setDeletingDupId(null);
                                                  setDuplicateSuccessMsg('تم حذف الحساب المكرر نهائياً بنجاح ✅');
                                                  setTimeout(() => setDuplicateSuccessMsg(null), 3500);
                                                }}
                                                className="px-2 py-1 bg-red-600 text-white rounded text-[9px] font-bold hover:bg-red-700 cursor-pointer transition-all"
                                              >
                                                نعم، احذف
                                              </button>
                                              <button
                                                onClick={() => setDeletingDupId(null)}
                                                className="px-2 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded text-[9px] font-bold hover:bg-slate-200 cursor-pointer transition-all"
                                              >
                                                إلغاء
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => {
                                                  const updated = { ...dupStudent, isSiblingApproved: true };
                                                  dbEngine.updateStudent(updated);
                                                  loadDatabase();
                                                  setDuplicateSuccessMsg(`تم اعتماد الطالب ${dupStudent.name} كحساب إخوة معتمد مستثنى من التكرار بنجاح 🎉`);
                                                  setTimeout(() => setDuplicateSuccessMsg(null), 4000);
                                                }}
                                                className="px-2 py-1.5 bg-emerald-55 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 text-emerald-700 rounded-lg text-[10px] font-bold cursor-pointer transition"
                                                title="اعتماد كحساب إخوة معتمد"
                                              >
                                                موافقة إخوة ✅
                                              </button>
                                              <button
                                                onClick={() => setEditingDupStudent(dupStudent)}
                                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-indigo-600 rounded-lg text-[10px] font-bold cursor-pointer transition"
                                                title="تعديل البيانات"
                                              >
                                                تعديل
                                              </button>
                                              <button
                                                onClick={() => setDeletingDupId(dupStudent.id)}
                                                className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold cursor-pointer transition"
                                                title="حذف الحساب المكرر"
                                              >
                                                حذف
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Excluded Sibling Approved list */}
                    {(() => {
                      const siblingApprovedStudents = students.filter(s => s.grade === selectedDuplicateGrade && s.status === 'approved' && s.isSiblingApproved);
                      if (siblingApprovedStudents.length === 0) return null;
                      return (
                        <div className="pt-4 border-t border-slate-250 border-dashed mt-4">
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => setShowApprovedSiblings(!showApprovedSiblings)}
                              className="text-xs text-indigo-600 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{showApprovedSiblings ? 'إخفاء حسابات الإخوة المعتمدة' : `عرض حسابات الإخوة المعتمدة المستثناة (${siblingApprovedStudents.length}) 👥`}</span>
                            </button>
                            <span className="text-[10px] text-slate-400 font-bold">حسابات تم قبول تكرارها كإخوة</span>
                          </div>
                          
                          {showApprovedSiblings && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 animate-in fade-in slide-in-from-top-2">
                              {siblingApprovedStudents.map(student => (
                                <div key={student.id} className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl flex items-center justify-between">
                                  <button
                                    onClick={() => {
                                      const updated = { ...student, isSiblingApproved: false };
                                      dbEngine.updateStudent(updated);
                                      loadDatabase();
                                      setDuplicateSuccessMsg(`تم إلغاء اعتماد إخوة للطالب ${student.name} وإعادته للفحص ✅`);
                                      setTimeout(() => setDuplicateSuccessMsg(null), 3000);
                                    }}
                                    className="px-2 py-1 bg-white hover:bg-slate-55 hover:bg-slate-100 border border-slate-200 text-rose-600 rounded-lg text-[9px] font-bold cursor-pointer transition"
                                  >
                                    إلغاء الاستثناء كإخوة
                                  </button>
                                  <div className="text-right space-y-0.5">
                                    <h6 className="font-extrabold text-xs text-slate-850 flex items-center gap-1 justify-end">
                                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">إخوة معتمد</span>
                                      <span>{student.name}</span>
                                    </h6>
                                    <p className="text-[9px] text-slate-500 font-semibold">كود: {student.code} — هاتف: {student.parentPhone}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* EDIT DUP STUDENT MODAL */}
                  {editingDupStudent && (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 text-right font-sans">
                      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-right">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <button 
                            onClick={() => setEditingDupStudent(null)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer transition"
                          >
                            X
                          </button>
                          <h4 className="font-extrabold text-slate-900 text-sm">تعديل بيانات الطالب المكرر</h4>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1">اسم الطالب:</label>
                            <input
                              type="text"
                              value={editingDupStudent.name}
                              onChange={(e) => setEditingDupStudent({ ...editingDupStudent, name: e.target.value })}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 text-right font-bold"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-bold text-slate-500 block mb-1">كود الطالب:</label>
                              <input
                                type="text"
                                value={editingDupStudent.code}
                                onChange={(e) => setEditingDupStudent({ ...editingDupStudent, code: e.target.value })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 text-right font-bold font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-bold text-slate-500 block mb-1">هاتف ولي الأمر:</label>
                              <input
                                type="text"
                                value={editingDupStudent.parentPhone}
                                onChange={(e) => setEditingDupStudent({ ...editingDupStudent, parentPhone: e.target.value })}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 text-right font-bold font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1">المدرسة:</label>
                            <input
                              type="text"
                              value={editingDupStudent.school || ''}
                              onChange={(e) => setEditingDupStudent({ ...editingDupStudent, school: e.target.value })}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-indigo-500 text-right font-medium"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-slate-500 block mb-1">المجموعة الحالية:</label>
                            <select
                              value={editingDupStudent.groupId}
                              onChange={(e) => setEditingDupStudent({ ...editingDupStudent, groupId: e.target.value })}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-slate-800 text-right"
                            >
                              {groups.filter(g => g.grade === selectedDuplicateGrade).map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => {
                              dbEngine.updateStudent(editingDupStudent);
                              loadDatabase();
                              setEditingDupStudent(null);
                              setDuplicateSuccessMsg('تم حفظ البيانات بنجاح ✅');
                              setTimeout(() => setDuplicateSuccessMsg(null), 3000);
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
                          >
                            حفظ التعديلات
                          </button>
                          <button
                            onClick={() => setEditingDupStudent(null)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Split Layout for Honor List and Approval pending list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                    
                    {/* Left: Honor List of Top Scores */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <AwardIcon className="w-4 h-4 text-amber-500" />
                          لوحة الشرف (أعلى نتائج مادة العلوم)
                        </h4>
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-bold">المتفوقين كلياً</span>
                      </div>

                      <div className="divide-y divide-slate-100 text-xs">
                        {bestPerformingStudents.length === 0 ? (
                          <p className="text-center py-8 text-slate-400 italic">لا توجد درجات مرصودة حتى الآن لدعم لوحة الشرف.</p>
                        ) : (
                          bestPerformingStudents.map((score, idx) => (
                            <div key={idx} className="py-3 flex justify-between items-center bg-slate-50/50 px-2.5 rounded-xl mt-1 hover:bg-slate-50 transition">
                              <div className="space-y-1">
                                <span className="font-bold text-slate-800 inline-block">{score.studentName}</span>
                                <p className="text-[10px] text-slate-450">{score.examTitle}</p>
                              </div>
                              <div className="text-left font-mono font-black text-blue-600">
                                {score.score} درجة
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right: Quick Action approval queue (Pending requests) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-blue-600" />
                          طلبات تسجيل معلّقة بانتظار الاعتماد
                        </h4>
                        {pendingRequestsCount > 0 && (
                          <span className="text-[10px] bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-sans font-bold">{pendingRequestsCount} طالب</span>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100 text-xs space-y-2">
                        {students.filter(s => s.status === 'pending').length === 0 ? (
                          <div className="text-center py-10 space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                            <p className="text-slate-400 font-bold">تم اعتماد عينات كافة الطلاب بنجاح!</p>
                          </div>
                        ) : (
                          students.filter(s => s.status === 'pending').slice(0, 3).map((student) => (
                            <div key={student.id} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-150">
                              <div>
                                <h5 className="font-bold text-slate-800">{student.name}</h5>
                                <p className="text-[10px] text-slate-400 mt-1">الصف: {student.grade} — مدرسة {student.school || 'عامة'}</p>
                              </div>
                              <button
                                onClick={() => {
                                  dbEngine.updateStudentStatus(student.id, 'approved');
                                  loadDatabase();
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                              >
                                قبول واعتماد
                              </button>
                            </div>
                          ))
                        )}
                        
                        {pendingRequestsCount > 3 && (
                          <button 
                            onClick={() => setActiveTeacherTab('students')}
                            className="w-full text-center text-blue-600 font-bold block pt-2 text-[11px] hover:underline"
                          >
                            عرض كافة الطلبات البالغ عددها ({pendingRequestsCount})...
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {activeTeacherTab === 'students' && (
                <StudentManager 
                  students={students} 
                  groups={groups} 
                  prices={prices}
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'groups' && (
                <GroupsManager 
                  groups={groups} 
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'attendance' && (
                <AttendanceManager 
                  students={students} 
                  groups={groups} 
                  attendance={attendance}
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'finances' && (
                <FinanceManager 
                  students={students} 
                  payments={payments} 
                  prices={prices}
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'exams' && (
                <ExamsManager 
                  students={students} 
                  exams={exams} 
                  examScores={examScores}
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'whatsapp' && (
                <WhatsAppSender 
                  templates={templates} 
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'reports' && (
                <ReportsManager 
                  students={students} 
                  groups={groups} 
                  payments={payments} 
                  attendance={attendance}
                  exams={exams} 
                  examScores={examScores}
                  prices={prices}
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'weekly-planner' && (
                <WeeklyAttendancePlanner 
                  students={students} 
                  groups={groups} 
                  onRefresh={loadDatabase} 
                />
              )}

              {activeTeacherTab === 'backup' && (
                <DatabaseBackup 
                  onRefresh={loadDatabase} 
                />
              )}

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PAR PORTAL (PORTAL FOR PARENTS)                           */}
        {/* ========================================================= */}
        {userRole === 'parent' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-sm print:border-none print:p-0">
            <div className="border-b border-slate-100 pb-4 no-print">
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1 rounded-md font-bold inline-block">بوابة أولياء الأمور لمتابعة مستويات الطلاب</span>
              <h3 className="text-xl font-bold text-slate-900 font-sans mt-2">كشف درجات وسجلات حضور مادة العلوم للأبناء</h3>
              <p className="text-xs text-slate-500 mt-1">يمكنك الاستعلام والاطلاع الفوري على تفاصيل حضور طفلك وغيابه، وسداد اشتراكه، ونقاط علاماته بالمركز.</p>
            </div>

            {/* If parent entered, show lookup box or show results */}
            <form onSubmit={handleParentSearchSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl no-print">
              <input
                type="tel"
                required
                placeholder="أدخل تليفون الوالد المسجل (مثال: 01198765432)"
                value={parentPhoneInput}
                onChange={(e) => setParentPhoneInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-mono font-bold outline-none transition text-right focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Search className="w-4 h-4" />
                تحديث البحث
              </button>
            </form>

            <div className="pt-2">
              {!activePortalParentSearchDone ? (
                <div className="text-center py-6 text-slate-400 font-medium text-xs">الرجاء إدخال رقم تليفون الوالد المسجل للاستعلام الفوري التفاعلي.</div>
              ) : activePortalParentStudents.length === 0 ? (
                <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <span className="text-xs font-bold">عفواً، لا يوجد طالب مضاف حالياً في المركز مسجل تحت رقم الهاتف المدخل. يرجى التواصل مع مسؤول السنتر فورياً للتثبيت.</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Show Students */}
                  {activePortalParentStudents.map((student) => {
                    // attendance counting
                    const studentRosterAttendance = attendance.filter(a => a.studentId === student.id);
                    const presentCount = studentRosterAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
                    const lateCount = studentRosterAttendance.filter(a => a.status === 'late').length;
                    const totalSessions = studentRosterAttendance.length;

                    // exams score
                    const studentScores = examScores.filter(s => s.studentId === student.id);

                    // payment month check
                    const currentMonth = getCurrentArabicMonthName();
                    const studentPayments = payments.filter(p => p.studentId === student.id && p.month === currentMonth);
                    const precedesReg = doesMonthPrecedeDate(currentMonth, student.createdAt);
                    const balanceOwed = precedesReg ? 0 : (student.exemptionType === 'full' ? 0 : Math.max(0, prices[student.grade] - (student.exemptionType === 'partial' ? student.discountAmount : 0)));
                    const totalPaidThisMonth = studentPayments.reduce((acc, p) => acc + p.amountPaid, 0);
                    const isFullyPaid = precedesReg || student.exemptionType === 'full' || totalPaidThisMonth >= balanceOwed;

                    return (
                      <div key={student.id} className="bg-slate-50/50 rounded-xl p-5 border border-slate-200 space-y-6">
                        
                        {/* Upper Student Profile head */}
                        <div className="flex flex-col sm:flex-row justify-between border-b border-slate-100 pb-4 gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-100 font-mono font-bold px-2 py-0.5 rounded-md">{student.code}</span>
                            <h4 className="text-base font-bold text-slate-900 pt-1">{student.name}</h4>
                            <p className="text-xs text-slate-500">مرحلة: {student.grade} — مدرسة: {student.school || 'عامة'}</p>
                          </div>
                          
                          <div className="text-left font-semibold text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 self-center">
                            المجموعة الحالية: <span className="text-blue-600 font-bold">{groups.find(g => g.id === student.groupId)?.name || 'غير محدد'}</span>
                          </div>
                        </div>

                        {/* Three Bento stat blocks */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* 1. Attendance Block */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                            <h5 className="font-bold text-xs text-slate-800 pb-1.5 border-b border-slate-100">سجل حضور الطالب</h5>
                            <div className="text-xs space-y-1">
                              <p className="text-slate-500">حضر الحصص المسجلة:</p>
                              <p className="text-base font-bold text-blue-600 font-mono">{presentCount} من إجمالي {totalSessions} حصص</p>
                              {lateCount > 0 && <p className="text-[10px] text-amber-600 font-bold">تأخر الطالب عن البداية في: {lateCount} حِصص</p>}
                            </div>
                            
                            {/* Table of full log */}
                            {totalSessions > 0 && (
                              <div className="mt-2 text-[10px] max-h-24 overflow-y-auto divide-y divide-slate-100 border border-slate-150 rounded bg-slate-50/50 p-2 leading-relaxed">
                                {studentRosterAttendance.map((a) => (
                                  <div key={a.id} className="flex justify-between py-1 px-1">
                                    <span className="font-mono">{a.date}</span>
                                    <span className={`font-bold ${a.status === 'present' || a.status === 'late' ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب اليوم' : a.status === 'late' ? 'حضر متأخر' : 'مستأذن'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. Exams Block */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                            <h5 className="font-bold text-xs text-slate-800 pb-1.5 border-b border-slate-100">درجات وتقييمات العلوم الأكاديمية</h5>
                            
                            <div className="space-y-2 text-xs">
                              {studentScores.length === 0 ? (
                                <p className="text-slate-400 italic text-center py-4">لا توجد درجات مرصودة للاختبارات الحالية.</p>
                              ) : (
                                studentScores.map((score, index) => {
                                  const exam = exams.find(e => e.id === score.examId);
                                  const pct = exam ? (score.score / exam.maxScore) * 100 : 0;
                                  
                                  return (
                                    <div key={index} className="flex justify-between py-1 border-b border-slate-100 items-center">
                                      <div className="space-y-0.5">
                                        <span className="font-semibold text-slate-700 inline-block truncate max-w-[130px]">{score.examTitle}</span>
                                        <div className="text-[9px] text-slate-400">تاريخ: {exam?.date || '—'}</div>
                                      </div>
                                      <div className="text-left font-mono font-bold">
                                        <span className={`px-1.5 py-0.5 rounded-md font-sans text-[9px] ${
                                          pct >= 90 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : pct >= 50 ? 'bg-blue-50 text-blue-800 border border-blue-100' : 'bg-red-50 text-red-605'
                                        }`}>
                                          {score.score} / {exam?.maxScore || 20}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* 3. Finance state */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                            <h5 className="font-bold text-xs text-slate-800 pb-1.5 border-b border-slate-100">حالة سداد الرسوم واشتراك الدروس</h5>
                            
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-500">القيمة الشهرية المطلوبة:</span>
                                <strong className="text-slate-800 font-mono">{prices[student.grade]} ج.م</strong>
                              </div>

                              <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="text-slate-500">خصومات / إعفاءات الطالب:</span>
                                <strong className="text-slate-700">
                                  {student.exemptionType === 'full' ? 'إعفاء كلي' : student.exemptionType === 'partial' ? `خصم جزئي ${student.discountAmount} ج.م` : 'لا يوجد'}
                                </strong>
                              </div>

                              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                                <span className="font-bold text-slate-600">حالة شهر {currentMonth}:</span>
                                {precedesReg ? (
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded">يسبق تاريخ التسجيل 🔒</span>
                                ) : isFullyPaid ? (
                                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-850 border border-emerald-100 px-2 py-0.5 rounded">مدفوع ومسدد ✅</span>
                                ) : (
                                  <span className="text-[10px] font-bold bg-red-50 text-red-650 border border-red-100 px-2 py-0.5 rounded">مطلوب {balanceOwed} ج.م</span>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STUDENT PORTAL (PORTAL FOR STUDENTS)                     */}
        {/* ========================================================= */}
        {userRole === 'student' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-sm print:border-none print:p-0">
            <div className="border-b border-slate-100 pb-4 no-print">
              <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-100 px-3 py-1 rounded-md font-bold inline-block font-sans">بوابة الطالب الأكاديمية لمادة العلوم</span>
              <h3 className="text-xl font-bold text-slate-900 mt-2 font-sans">أهلاً بك يا بطل العلوم المستقبلي! 🎓</h3>
              <p className="text-xs text-slate-500 mt-1">تتبع كود عضويتك ومواعيد حصصك، وقم باستخراج وطباعة كارت الباركود الرقمي للدخول السريع للسنتر.</p>
            </div>

            <form onSubmit={handleStudentSearchSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl no-print">
              <input
                type="text"
                required
                placeholder="أدخل كودك كطالب للاستعلام الفوري (مثال: S-1001)"
                value={studentCodeInput}
                onChange={(e) => setStudentCodeInput(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-mono font-bold text-right outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Search className="w-4 h-4" />
                تنزيل البيانات
              </button>
            </form>

            {activePortalStudentError && (
              <div className="p-4 bg-red-50 text-red-800 border border-red-100 rounded-lg text-xs font-bold">
                عفواً، لم يعثر السنتر على الكود المدخل. يرجى مراجعة كارتك أو الاستفسار من المعلم محمود أبو ذكري فورياً لتصحيح الرمز.
              </div>
            )}

            {activePortalStudent && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Student identity card */}
                <div className="bg-slate-50 border border-slate-250 rounded-2xl p-5 md:col-span-1 space-y-4 text-center">
                  <h4 className="font-bold text-slate-800 text-sm pb-2 border-b border-slate-200">الكارت الذكي الشخصي QR</h4>
                  <p className="text-[11px] text-slate-450 leading-relaxed font-medium">اعرض هذا الكود عند بوابة السنتر لمسح حضورك فوراُ بغير انتظار.</p>
                  
                  <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block select-none shadow-xs">
                    <QRCodeSVG 
                      value={activePortalStudent.id} 
                      size={140}
                      bgColor={"#FFFFFF"}
                      fgColor={"#0f172a"}
                      level={"L"}
                    />
                    <div className="font-mono text-xs font-bold text-slate-800 mt-2 tracking-widest">{activePortalStudent.code}</div>
                  </div>

                  <div className="text-right text-xs space-y-1.5 p-3.5 bg-white border border-slate-200 rounded-xl leading-relaxed">
                    <p className="text-slate-450 font-bold text-center pb-1 border-b border-slate-100 mb-1">بيانات الرابط</p>
                    <p>المتعلم: <strong className="text-slate-900">{activePortalStudent.name}</strong></p>
                    <p>الصف: <strong className="text-slate-900">{activePortalStudent.grade}</strong></p>
                    <p>المدرسة: <strong className="text-slate-700">{activePortalStudent.school || '—'}</strong></p>
                  </div>
                </div>

                {/* 2. Registered Group calendar details & Exams progress */}
                <div className="md:col-span-2 space-y-6">
                  {/* Group Calendar card */}
                  {(() => {
                    const group = groups.find(g => g.id === activePortalStudent.groupId);
                    return (
                      <div className="bg-slate-100/60 p-5 rounded-2xl border border-slate-200">
                        <h4 className="font-bold text-slate-900 text-sm">مجموعة دراستك الحالية والجدول</h4>
                        {group ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 text-xs text-slate-800 font-semibold font-sans">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-center text-center">
                              <span className="text-[10px] text-slate-400">اسم المجموعة</span>
                              <strong className="text-xs font-bold mt-0.5">{group.name}</strong>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-center text-center">
                              <span className="text-[10px] text-slate-400">الموعد الأسبوعي</span>
                              <strong className="text-xs font-bold mt-0.5">{group.day}</strong>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-center text-center">
                              <span className="text-[10px] text-slate-400">ساعة الحضور</span>
                              <strong className="text-xs font-bold mt-0.5">{group.time}</strong>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600 mt-2">عفواً، لم يربط حسابك بمجموعة محددة بعد بالمركز.</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Scientific Evaluation chart scores list */}
                  <div className="bg-white p-5 border border-slate-200 rounded-2xl space-y-4 shadow-xs">
                    <h4 className="font-bold text-slate-800 text-sm pb-2 border-b border-slate-150 flex items-center gap-1.5">
                      <Award className="w-5 h-5 text-blue-600" />
                      سجل درجاتك في اختبارات العلوم
                    </h4>

                    <div className="divide-y divide-slate-100 text-xs space-y-2">
                      {examScores.filter(s => s.studentId === activePortalStudent.id).length === 0 ? (
                        <p className="text-slate-400 italic py-6 text-center">لم ترصد أي درجات اختبار علوم لك حتى اللحظة بالمركز.</p>
                      ) : (
                        examScores.filter(s => s.studentId === activePortalStudent.id).map((score) => {
                          const exam = exams.find(e => e.id === score.examId);
                          const pct = exam ? (score.score / exam.maxScore) * 100 : 0;
                          return (
                            <div key={score.id} className="py-3 flex justify-between items-center hover:bg-slate-50 transition px-2 rounded-xl">
                              <div>
                                <h5 className="font-bold text-slate-800">{score.examTitle}</h5>
                                <span className="text-[10px] text-slate-400 font-medium">تاريخ الامتحان: {exam?.date || '—'}</span>
                              </div>

                              <div className="text-left font-mono font-bold">
                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                                  pct >= 90 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : pct >= 50 ? 'bg-blue-50 text-blue-800 border border-blue-100' : 'bg-red-50 text-red-650'
                                }`}>
                                  درجتك: {score.score} من كلي {exam?.maxScore || 20}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* Beautiful footer crediting الاستاذ محمود ابوذكري */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-slate-400 text-xs mt-20 no-print">
        <p className="font-bold text-slate-550">مجموعات العلوم المتكاملة — تكنولوجيا الذكاء المدرسي</p>
        <p className="mt-1 leading-normal leading-relaxed text-slate-400">الحقوق محفوظة بمركز القائد العلمي للأستاذ محمود أبوذكري © 2026. طوّر نظامك لتعليم أكثر ذكاءً.</p>
      </footer>

      {/* Secret Authenticator overlay door lock */}
      {showSecretModal && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-700 text-white max-w-sm w-full rounded-3xl p-6 md:p-8 text-center space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            {/* Close Button */}
            <button 
              onClick={() => {
                setShowSecretModal(false);
                setIsPasswordError(false);
                setSecretInput('');
              }}
              className="absolute top-4 left-4 w-7 h-7 bg-slate-800 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition cursor-pointer text-xs"
            >
              ✕
            </button>

            {/* Shield and Lock Icon representation */}
            <div className="mx-auto w-14 h-14 bg-blue-605 bg-blue-600 text-blue-100 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(37,99,235,0.4)]">
              <Lock className="w-7 h-7" />
            </div>

            {/* Information */}
            <div className="space-y-1.5">
              <h3 className="text-base font-black tracking-tight font-sans">بوابة الطاقم الإداري السرية</h3>
              <p className="text-[10px] text-slate-400 leading-normal">يجب إدخال كلمة المرور المعتمدة للأستاذ محمود أبوذكري</p>
            </div>

            {/* Password input display container */}
            <form onSubmit={handleSecretLoginSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  autoFocus
                  placeholder="••••••••"
                  value={secretInput}
                  onChange={(e) => {
                    setIsPasswordError(false);
                    setSecretInput(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-center text-lg tracking-widest font-mono text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-700"
                />
              </div>

              {isPasswordError && (
                <p className="text-[11px] text-red-400 font-bold animate-pulse">⚠️ الرقم السري خاطئ! يرجى إعادة المحاولة.</p>
              )}

              {/* Grid numeric lock keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setIsPasswordError(false);
                      setSecretInput(prev => prev + num);
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-755 active:bg-slate-700 rounded-xl font-mono text-base font-bold text-slate-200 transition cursor-pointer border border-slate-700/45 select-none"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Clear (C) button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordError(false);
                    setSecretInput('');
                  }}
                  className="w-full py-2.5 bg-red-950/20 text-red-400 hover:bg-red-900/30 rounded-xl font-sans text-xs font-bold transition cursor-pointer border border-red-900/30 select-none"
                >
                  مسح
                </button>

                {/* 0 digit */}
                <button
                  key="0"
                  type="button"
                  onClick={() => {
                    setIsPasswordError(false);
                    setSecretInput(prev => prev + '0');
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-755 active:bg-slate-700 rounded-xl font-mono text-base font-bold text-slate-200 transition cursor-pointer border border-slate-700/45 select-none"
                >
                  0
                </button>

                {/* Submit login */}
                <button
                  type="button"
                  onClick={() => handleSecretLoginSubmit()}
                  className="w-full py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-sans text-xs font-black transition cursor-pointer border border-blue-500 select-none shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                >
                  دخول
                </button>
              </div>

              {/* Subtle login helper */}
              <div className="pt-2">
                <span className="text-[10px] text-slate-500 block">
                  💡 تلميح: انقر ٥ مرات على الشعار العلوي لطلب الدخول السريع أو استخدم الاختصار المعتمد.
                </span>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
