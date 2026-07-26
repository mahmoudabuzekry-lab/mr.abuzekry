/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { dbEngine } from '../db';
import { Student, Group, Attendance, ARABIC_MONTHS_MAP } from '../types';
import { 
  Calendar, Users, QrCode, Camera, CheckCircle2, AlertTriangle, 
  Clock, X, Search, Check, AlertCircle, HelpCircle, LogIn, LogOut,
  MessageSquare, Sparkles, Send, Info, Trash2, Edit, CheckSquare, Volume2,
  RefreshCw, UserCheck, Plus, Filter, History, FileText
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const parseGroupDays = (dayStr: string): string[] => {
  if (!dayStr) return [];
  return dayStr
    .split(/ و |,|،|and/)
    .map(d => d.trim())
    .filter(Boolean);
};

const ensureDateString = (d: any): string => {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  if (typeof d === 'object' && d !== null && 'toDate' in d && typeof (d as any).toDate === 'function') {
    try {
      return (d as any).toDate().toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }
  if (typeof d === 'number') {
    try {
      return new Date(d).toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  }
  return String(d);
};

const getArabicDayName = (dateVal: any): string => {
  if (!dateVal) return '';
  const dateStr = ensureDateString(dateVal);
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const dayIndex = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return dayNames[dayIndex] || '';
};

const isDateInSelectedMonth = (dateVal: any, monthStr: string): boolean => {
  if (!dateVal || !monthStr || monthStr === 'all') return true;
  const dateStr = ensureDateString(dateVal);
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return true;
  const parts = dateStr.split('-');
  if (parts.length < 2) return true;
  const monthNum = parseInt(parts[1], 10);

  let targetMonthNum = 0;
  for (const [mName, mVal] of Object.entries(ARABIC_MONTHS_MAP)) {
    if (monthStr.includes(mName)) {
      targetMonthNum = mVal;
      break;
    }
  }
  if (targetMonthNum === 0) return true;
  return monthNum === targetMonthNum;
};

const isDateInSelectedWeek = (dateVal: any, weekStr: string): boolean => {
  if (!dateVal || !weekStr || weekStr === 'all') return true;
  const dateStr = ensureDateString(dateVal);
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return true;
  const parts = dateStr.split('-');
  if (parts.length < 3) return true;
  const dayNum = parseInt(parts[2], 10);
  if (isNaN(dayNum)) return true;

  if (weekStr === '1') return dayNum >= 1 && dayNum <= 7;
  if (weekStr === '2') return dayNum >= 8 && dayNum <= 14;
  if (weekStr === '3') return dayNum >= 15 && dayNum <= 21;
  if (weekStr === '4') return dayNum >= 22 && dayNum <= 31;
  return true;
};

interface AttendanceManagerProps {
  students: Student[];
  groups: Group[];
  attendance: Attendance[];
  onRefresh: () => void;
}

export default function AttendanceManager({ students, groups, attendance, onRefresh }: AttendanceManagerProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'all_dates'>('daily');

  const [selectedGrade, setSelectedGrade] = useState<string>('الكل');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('الكل');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // State for All-Dates Attendance Search and Management
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historySelectedStudentId, setHistorySelectedStudentId] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historyGroupFilter, setHistoryGroupFilter] = useState<string>('all');
  const [historyMonthFilter, setHistoryMonthFilter] = useState<string>('all');
  const [historyWeekFilter, setHistoryWeekFilter] = useState<string>('all');

  // State for Retroactive Attendance Addition Modal
  const [isAddHistoryModalOpen, setIsAddHistoryModalOpen] = useState(false);
  const [addHistoryForm, setAddHistoryForm] = useState({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    groupId: '',
    status: 'present' as 'present' | 'absent' | 'late' | 'excused',
    checkInTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    checkOutTime: ''
  });

  // State for Editing Attendance Record
  const [editingAttendance, setEditingAttendance] = useState<{
    isOpen: boolean;
    student: Student;
    record: Attendance;
  } | null>(null);

  // State for Flexible Attendance (Guest Student) Modal
  const [isFlexModalOpen, setIsFlexModalOpen] = useState(false);
  const [flexStudentId, setFlexStudentId] = useState('');
  const [flexStatus, setFlexStatus] = useState<'present' | 'late'>('present');
  const [flexSearchQuery, setFlexSearchQuery] = useState('');

  // State for WhatsApp Notification Modal
  const [notificationModal, setNotificationModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    templateType: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom';
    messageText: string;
  }>({
    isOpen: false,
    student: null,
    templateType: 'attendance',
    messageText: '',
  });

  const formatNotificationTemplate = (
    templateText: string, 
    student: Student, 
    todayRecord?: any
  ) => {
    let result = templateText;
    const group = groups.find(g => g.id === student.groupId);
    
    // Prepare values
    const timeNow = todayRecord?.checkInTime || todayRecord?.checkOutTime || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const currentMonth = new Date().toLocaleDateString('ar-EG', { month: 'long' });
    const formattedDate = new Date(selectedDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });

    const replacements: Record<string, string> = {
      '[اسم_الطالب]': student.name,
      '[اسم_المجموعة]': group ? group.name : 'مجموعة العلوم',
      '[الدرجة]': '—',
      '[الدرجة_النهائية]': '—',
      '[التقييم]': '—',
      '[اسم_الاختبار]': '—',
      '[الشهر]': currentMonth,
      '[التاريخ]': formattedDate,
      '[الصف_الدراسي]': student.grade,
      '[المبلغ]': String(dbEngine.getPrices()[student.grade] || '0'),
      '[الوقت]': timeNow
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      result = result.replaceAll(placeholder, value);
    });

    return result;
  };

  const handleOpenNotificationModal = (student: Student) => {
    // Determine the logical default template type based on attendance status
    let defaultType: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' = 'attendance';
    
    const todayRecord = attendance.find(a => a.studentId === student.id && a.date === selectedDate);
    if (todayRecord?.status === 'absent') {
      defaultType = 'absence';
    } else if (todayRecord?.checkOutTime) {
      defaultType = 'checkout';
    } else if (todayRecord?.status === 'late' || todayRecord?.status === 'present') {
      defaultType = 'attendance';
    }

    // Load templates
    const templates = dbEngine.getTemplates();
    const tpl = templates.find(t => t.type === defaultType) || templates.find(t => t.type === 'custom') || { text: 'السلام عليكم ورحمة الله وبركاته' };
    
    const formattedText = formatNotificationTemplate(tpl.text, student, todayRecord);

    setNotificationModal({
      isOpen: true,
      student,
      templateType: defaultType,
      messageText: formattedText
    });
  };

  const handleTemplateTypeChange = (type: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom') => {
    if (!notificationModal.student) return;
    
    const templates = dbEngine.getTemplates();
    const tpl = templates.find(t => t.type === type) || { text: '' };
    const todayRecord = attendance.find(a => a.studentId === notificationModal.student!.id && a.date === selectedDate);
    
    const formattedText = formatNotificationTemplate(tpl.text, notificationModal.student, todayRecord);
    
    setNotificationModal(prev => ({
      ...prev,
      templateType: type,
      messageText: formattedText
    }));
  };

  const handleSendWhatsAppNotification = () => {
    if (!notificationModal.student) return;
    
    let cleanPhone = notificationModal.student.parentPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) {
      cleanPhone = `20${cleanPhone}`; // Egypt country code
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(notificationModal.messageText)}`;
    window.open(waUrl, '_blank');
    
    setNotificationModal(prev => ({ ...prev, isOpen: false }));
  };
  
  // Helper to parse time string like "04:00 م" or "16:00" into minutes past midnight
  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const isPM = /م|مساء|pm/i.test(timeStr);
    const isAM = /ص|صباح|am/i.test(timeStr);
    
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  };

  const evaluateScheduleMismatch = (
    student: Student,
    groups: Group[],
    selectedDate: string,
    selectedGroupId: string,
    scanTimeStr: string
  ) => {
    const primaryGroup = groups.find(g => g.id === student.groupId);
    const altGroups = groups.filter(g => student.alternativeGroupIds?.includes(g.id));
    const activeSelectedGroup = groups.find(g => g.id === selectedGroupId && selectedGroupId !== 'الكل');

    const todayDayName = getArabicDayName(selectedDate);
    
    const primaryDays = primaryGroup ? parseGroupDays(primaryGroup.day) : [];
    const altDays = altGroups.flatMap(g => parseGroupDays(g.day));
    const customDays = student.attendanceDays || [];
    const allScheduledDays = Array.from(new Set([...primaryDays, ...altDays, ...customDays]));

    const isWrongDay = allScheduledDays.length > 0 && !allScheduledDays.includes(todayDayName);

    let isWrongGroup = false;
    if (activeSelectedGroup) {
      const isAssignedToActive = student.groupId === activeSelectedGroup.id || 
        (student.alternativeGroupIds && student.alternativeGroupIds.includes(activeSelectedGroup.id));
      if (!isAssignedToActive) {
        isWrongGroup = true;
      }
    }

    let isWrongTime = false;
    const targetGroupForTime = activeSelectedGroup || primaryGroup;
    let scheduledTimeStr = targetGroupForTime?.time || '';
    
    if (scheduledTimeStr.includes('|')) {
      const segments = scheduledTimeStr.split('|');
      const todaySeg = segments.find(s => s.includes(todayDayName));
      if (todaySeg && todaySeg.includes(':')) {
        scheduledTimeStr = todaySeg.split(':').slice(1).join(':').trim();
      }
    }

    const groupMinutes = parseTimeToMinutes(scheduledTimeStr);
    const scanMinutes = parseTimeToMinutes(scanTimeStr);

    if (groupMinutes !== null && scanMinutes !== null) {
      const diff = Math.abs(scanMinutes - groupMinutes);
      if (diff > 60) { // Difference greater than 60 minutes
        isWrongTime = true;
      }
    }

    const reasons: string[] = [];
    if (isWrongDay) {
      reasons.push(`اليوم (${todayDayName}) ليس ضمن أيام حضور الطالب المعتمدة (${allScheduledDays.join('، ') || 'غير محددة'})`);
    }
    if (isWrongGroup && activeSelectedGroup) {
      reasons.push(`الطالب مقيد بـ "${primaryGroup?.name || 'مجموعة أخرى'}"، بينما الجلسة الحالية لمجموعة: "${activeSelectedGroup.name}"`);
    }
    if (isWrongTime && scheduledTimeStr) {
      reasons.push(`توقيت مجموعة الطالب (${scheduledTimeStr}) يختلف عن وقت المسح الحاضر (${scanTimeStr})`);
    }

    const hasMismatch = isWrongDay || isWrongGroup || isWrongTime;

    return {
      hasMismatch,
      isWrongDay,
      isWrongGroup,
      isWrongTime,
      reasons,
      officialGroupName: primaryGroup?.name || 'غير محددة',
      officialGroupTime: scheduledTimeStr || primaryGroup?.time || 'غير محدد',
      officialGroupDays: allScheduledDays,
      activeGroupName: activeSelectedGroup?.name
    };
  };

  // Custom QR Scan Overlay state
  const [scanResult, setScanResult] = useState<{
    student: Student;
    status: 'success' | 'warning';
    paymentStatus: 'paid' | 'not_paid' | 'exempt';
    checkInTime?: string;
    scheduleMismatch?: {
      hasMismatch: boolean;
      isWrongDay: boolean;
      isWrongGroup: boolean;
      isWrongTime: boolean;
      reasons: string[];
      officialGroupName: string;
      officialGroupTime: string;
      officialGroupDays: string[];
      activeGroupName?: string;
    };
  } | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  // Active camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastScannedRef = useRef<{ id: string; time: number } | null>(null);
  const scanTimeoutRef = useRef<any>(null);

  // Set default group on mount
  useEffect(() => {
    if (groups.length > 0 && selectedGroupId === '') {
      setSelectedGroupId('الكل');
    }
  }, [groups]);

  // Handle manual attendance toggle
  const handleMarkAttendance = (student: Student, status: 'present' | 'absent' | 'late' | 'excused') => {
    const todayRecord = attendance.find(a => a.studentId === student.id && a.date === selectedDate);
    if (todayRecord && todayRecord.status === status) {
      // Toggle off! Delete the attendance record.
      dbEngine.deleteAttendance(todayRecord.id || `${student.id}_${selectedDate}`, student.id, selectedDate);
    } else {
      const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      const recordGroupId = (selectedGroupId && selectedGroupId !== 'الكل') ? selectedGroupId : student.groupId;
      dbEngine.addAttendance({
        id: `${student.id}_${selectedDate}`,
        studentId: student.id,
        studentName: student.name,
        groupId: recordGroupId,
        date: selectedDate,
        status,
        checkInTime: (status === 'present' || status === 'late') ? timeNow : undefined
      });
    }
    
    onRefresh();
  };

  // Handle marking all currently listed students in the filtered roster as present
  const handleMarkAllPresent = () => {
    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    
    filteredGroupStudents.forEach(student => {
      const todayRecord = attendance.find(a => a.studentId === student.id && a.date === selectedDate);
      if (!todayRecord || (todayRecord.status !== 'present' && todayRecord.status !== 'late')) {
        const recordGroupId = (selectedGroupId && selectedGroupId !== 'الكل') ? selectedGroupId : student.groupId;
        dbEngine.addAttendance({
          id: `${student.id}_${selectedDate}`,
          studentId: student.id,
          studentName: student.name,
          groupId: recordGroupId,
          date: selectedDate,
          status: 'present',
          checkInTime: timeNow
        });
      }
    });
    
    onRefresh();
  };

  // Synthesize loud high-pitched QR scanner sound alert
  const playQrScanAlertSound = (isWarning: boolean = false) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (!isWarning) {
        // High-pitch dual chime tone (1200Hz -> 1760Hz) loud beep
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, now);
        gain1.gain.setValueAtTime(0.5, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);

        setTimeout(() => {
          try {
            const t2 = ctx.currentTime;
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1760, t2);
            gain2.gain.setValueAtTime(0.65, t2);
            gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.22);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(t2);
            osc2.stop(t2 + 0.22);
          } catch (e) {}
        }, 75);
      } else {
        // Warning sound for unpaid student attendance
        [1100, 1400, 1700].forEach((freq, idx) => {
          setTimeout(() => {
            try {
              const t = ctx.currentTime;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'square';
              osc.frequency.setValueAtTime(freq, t);
              gain.gain.setValueAtTime(0.4, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(t);
              osc.stop(t + 0.1);
            } catch (e) {}
          }, idx * 85);
        });
      }
    } catch (err) {
      console.warn("QR Scan audio alert error", err);
    }
  };

  const playQrScanErrorAlert = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  };

  // Process a scanned / mock barcode student ID
  const processStudentQrScan = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      playQrScanErrorAlert();
      setScanErrorMessage('عذراً، كود الطالب الممسوح غير مطابق لأي سجل أو قد يكون تالفاً!');
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = setTimeout(() => {
        setScanErrorMessage(null);
      }, 2500);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    
    // Check if attendance already exists for today
    const existingRecord = attendance.find(a => a.studentId === student.id && a.date === todayStr);
    
    let status: 'success' | 'warning' = 'success';
    let checkInTime = timeNow;

    if (existingRecord && (existingRecord.status === 'present' || existingRecord.status === 'late')) {
      // Already registered, do nothing (no checkout/departure recording)
      status = 'success';
      checkInTime = existingRecord.checkInTime || timeNow;
    } else {
      // First scan, or was absent/excused = Present
      const recordGroupId = (selectedGroupId && selectedGroupId !== 'الكل') ? selectedGroupId : student.groupId;
      dbEngine.addAttendance({
        id: `${student.id}_${todayStr}`,
        studentId: student.id,
        studentName: student.name,
        groupId: recordGroupId,
        date: todayStr,
        status: 'present',
        checkInTime: timeNow
      });
    }

    // Determine current month payment status
    const currentMonth = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    const studentPayments = dbEngine.getPayments().filter(p => p.studentId === student.id && p.month.includes(currentMonth.split(' ')[0]));
    
    let paymentStatus: 'paid' | 'not_paid' | 'exempt' = 'not_paid';
    if (student.exemptionType === 'full') {
      paymentStatus = 'exempt';
    } else {
      const hasPaid = studentPayments.some(p => p.amountPaid >= p.amountDue);
      paymentStatus = hasPaid ? 'paid' : 'not_paid';
      
      if (paymentStatus === 'not_paid') {
        status = 'warning'; // highlight missing payment!
      }
    }

    // Determine schedule & timing mismatch
    const scheduleMismatch = evaluateScheduleMismatch(student, groups, selectedDate, selectedGroupId, timeNow);

    if (scheduleMismatch.hasMismatch) {
      status = 'warning';
    }

    // Play high-volume audio alert on scan (plays warning chime if missing payment or schedule mismatch)
    playQrScanAlertSound(status === 'warning' || scheduleMismatch.hasMismatch);

    setScanResult({
      student,
      status,
      paymentStatus,
      checkInTime,
      scheduleMismatch
    });

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    // Keep warning open longer (12 seconds) so teacher can select an action button
    scanTimeoutRef.current = setTimeout(() => {
      setScanResult(null);
    }, scheduleMismatch.hasMismatch ? 12000 : 2500);

    onRefresh();
  };

  // Schedule Mismatch Action Handlers
  const handleConfirmFlexAttendance = () => {
    if (!scanResult) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const recordGroupId = (selectedGroupId && selectedGroupId !== 'الكل') ? selectedGroupId : scanResult.student.groupId;
    
    dbEngine.addAttendance({
      id: `${scanResult.student.id}_${todayStr}`,
      studentId: scanResult.student.id,
      studentName: scanResult.student.name,
      groupId: recordGroupId,
      date: todayStr,
      status: 'present',
      checkInTime: scanResult.checkInTime || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    });
    
    setScanResult(prev => prev ? {
      ...prev,
      status: 'success',
      scheduleMismatch: prev.scheduleMismatch ? { ...prev.scheduleMismatch, hasMismatch: false } : undefined
    } : null);

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      setScanResult(null);
    }, 1500);

    onRefresh();
  };

  const handleTransferStudentGroup = () => {
    if (!scanResult || !selectedGroupId || selectedGroupId === 'الكل') return;
    const activeGroup = groups.find(g => g.id === selectedGroupId);
    if (!activeGroup) return;

    const updatedStudent: Student = {
      ...scanResult.student,
      groupId: selectedGroupId
    };

    dbEngine.updateStudent(updatedStudent);

    const todayStr = new Date().toISOString().split('T')[0];
    dbEngine.addAttendance({
      id: `${scanResult.student.id}_${todayStr}`,
      studentId: scanResult.student.id,
      studentName: scanResult.student.name,
      groupId: selectedGroupId,
      date: todayStr,
      status: 'present',
      checkInTime: scanResult.checkInTime || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    });

    setScanResult(prev => prev ? {
      ...prev,
      student: updatedStudent,
      status: 'success',
      scheduleMismatch: undefined
    } : null);

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      setScanResult(null);
    }, 2000);

    onRefresh();
  };

  const handleMarkLateException = () => {
    if (!scanResult) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const recordGroupId = (selectedGroupId && selectedGroupId !== 'الكل') ? selectedGroupId : scanResult.student.groupId;
    
    dbEngine.addAttendance({
      id: `${scanResult.student.id}_${todayStr}`,
      studentId: scanResult.student.id,
      studentName: scanResult.student.name,
      groupId: recordGroupId,
      date: todayStr,
      status: 'late',
      checkInTime: scanResult.checkInTime || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    });

    setScanResult(prev => prev ? {
      ...prev,
      status: 'success',
      scheduleMismatch: undefined
    } : null);

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      setScanResult(null);
    }, 1500);

    onRefresh();
  };

  const handleSendMismatchWhatsApp = () => {
    if (!scanResult) return;
    let cleanPhone = scanResult.student.parentPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) {
      cleanPhone = `20${cleanPhone}`;
    }

    const officialGroup = scanResult.scheduleMismatch?.officialGroupName || 'المجموعة الرسمية';
    const officialTime = scanResult.scheduleMismatch?.officialGroupTime || '';
    const msg = `السلام عليكم يا فندم، نود إحاطتكم علماً بأن الطالب/ة ${scanResult.student.name} حضر اليوم لدرس العلوم في غير موعد مجموعته الرسمية (${officialGroup} - ${officialTime}). تم تسجيل حضوره استثنائياً اليوم. شكرًا لتعاونكم. الأستاذ محمود أبوذكري.`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleCancelScanAttendance = () => {
    if (!scanResult) return;
    const todayStr = new Date().toISOString().split('T')[0];
    dbEngine.deleteAttendance(`${scanResult.student.id}_${todayStr}`, scanResult.student.id, todayStr);
    setScanResult(null);
    onRefresh();
  };

  // Start HTML5 Camera-based QRCode Scanner
  const startCameraScanner = () => {
    setIsCameraActive(true);
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "qr-reader-container",
          { 
            fps: 10, 
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true
          },
          /* verbose= */ false
        );
        scannerRef.current = scanner;
        
        scanner.render(
          (decodedText) => {
            const now = Date.now();
            if (lastScannedRef.current && lastScannedRef.current.id === decodedText && now - lastScannedRef.current.time < 3000) {
              return; // Ignore rapid consecutive duplicate scans of the same student
            }
            lastScannedRef.current = { id: decodedText, time: now };
            // Success: process scanned text (should be student.id)
            processStudentQrScan(decodedText);
          },
          (error) => {
            // failure is common when sweeps across blank area
          }
        );
      } catch (err) {
        console.error("Camera startup fail", err);
        setIsCameraActive(false);
      }
    }, 100);
  };

  const stopCameraScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(err => console.error("Scanner clear fail", err));
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Cleanup camera scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.log(err));
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Extract all unique grades from groups and approved students
  const availableGrades = Array.from(new Set([
    ...groups.map(g => g.grade),
    ...students.filter(s => s.status === 'approved').map(s => s.grade)
  ])).filter(Boolean);

  // Filter students showing the active selected grade/group roster
  const activeGroup = groups.find(g => g.id === selectedGroupId);
  const groupStudents = students.filter(s => {
    if (s.status !== 'approved') return false;
    
    // Grade filter
    if (selectedGrade !== 'الكل' && s.grade !== selectedGrade) return false;
    
    // Day compatibility check: Student's scheduled days MUST match the day of selectedDate
    const currentDayOfWeek = getArabicDayName(selectedDate);
    const primaryGroup = groups.find(g => g.id === s.groupId);
    const studentDays = s.attendanceDays || (primaryGroup ? parseGroupDays(primaryGroup.day) : []);
    const isCompatibleDay = studentDays.includes(currentDayOfWeek);
    
    if (!isCompatibleDay) return false;
    
    // Group filter
    if (selectedGroupId !== 'الكل') {
      const isPrimaryGroup = s.groupId === selectedGroupId;
      const isAlternativeGroup = s.alternativeGroupIds && s.alternativeGroupIds.includes(selectedGroupId);
      
      // Flexible week attendance intersection check
      const activeGroupDays = activeGroup ? parseGroupDays(activeGroup.day) : [];
      const isScheduledForGroupDays = activeGroup && s.grade === activeGroup.grade && activeGroupDays.some(d => studentDays.includes(d));
      
      const hasAttendanceTodayInThisGroup = attendance.some(a => a.studentId === s.id && a.date === selectedDate && a.groupId === selectedGroupId);
      
      if (!isPrimaryGroup && !isAlternativeGroup && !isScheduledForGroupDays && !hasAttendanceTodayInThisGroup) return false;
    }
    
    return true;
  });
  
  const filteredGroupStudents = groupStudents.filter(s => 
    s.name.includes(searchQuery) || s.code.includes(searchQuery)
  );

  // Attendance stats based on the filtered roster
  const studentIdsInRoster = new Set(groupStudents.map(s => s.id));
  const activeAttendanceForRoster = attendance.filter(a => studentIdsInRoster.has(a.studentId) && a.date === selectedDate);
  const presentCount = activeAttendanceForRoster.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentCount = activeAttendanceForRoster.filter(a => a.status === 'absent').length;
  const lateCount = activeAttendanceForRoster.filter(a => a.status === 'late').length;
  const excusedCount = activeAttendanceForRoster.filter(a => a.status === 'excused').length;
  const totalRosterCount = groupStudents.length;
  const attendancePercentage = totalRosterCount > 0 ? Math.round((presentCount / totalRosterCount) * 100) : 0;

  // Helper to change status for any historical attendance record directly
  const handleUpdateHistoricalStatus = (record: Attendance, newStatus: 'present' | 'absent' | 'late' | 'excused') => {
    if (record.status === newStatus) return;
    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    dbEngine.addAttendance({
      ...record,
      status: newStatus,
      checkInTime: (newStatus === 'present' || newStatus === 'late') ? (record.checkInTime || timeNow) : record.checkInTime
    });
    onRefresh();
  };

  // Filter all attendance records across ALL dates
  const filteredHistoryRecords = attendance.filter(record => {
    const student = students.find(s => s.id === record.studentId);
    
    if (historySelectedStudentId !== 'all' && record.studentId !== historySelectedStudentId) {
      return false;
    }

    if (historyStatusFilter !== 'all' && record.status !== historyStatusFilter) {
      return false;
    }

    if (historyGroupFilter !== 'all' && record.groupId !== historyGroupFilter) {
      return false;
    }

    if (historyMonthFilter !== 'all' && !isDateInSelectedMonth(record.date, historyMonthFilter)) {
      return false;
    }

    if (historyWeekFilter !== 'all' && !isDateInSelectedWeek(record.date, historyWeekFilter)) {
      return false;
    }

    if (historySearchQuery.trim()) {
      const q = historySearchQuery.trim().toLowerCase();
      const matchName = record.studentName?.toLowerCase().includes(q) || student?.name.toLowerCase().includes(q);
      const matchCode = student?.code.toLowerCase().includes(q);
      const matchPhone = student?.phone?.includes(q) || student?.parentPhone?.includes(q);
      const matchDate = record.date.includes(q);
      if (!matchName && !matchCode && !matchPhone && !matchDate) return false;
    }

    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const historyPresentCount = filteredHistoryRecords.filter(r => r.status === 'present' || r.status === 'late').length;
  const historyAbsentCount = filteredHistoryRecords.filter(r => r.status === 'absent').length;
  const historyLateCount = filteredHistoryRecords.filter(r => r.status === 'late').length;
  const historyExcusedCount = filteredHistoryRecords.filter(r => r.status === 'excused').length;

  const selectedStudentProfile = historySelectedStudentId !== 'all' 
    ? students.find(s => s.id === historySelectedStudentId) 
    : (historySearchQuery.trim() && filteredHistoryRecords.length > 0
        ? students.find(s => s.id === filteredHistoryRecords[0]?.studentId)
        : null);

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="attendance-manager">
      {/* MODE SWITCHER TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-2">
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>دفتر التحضير اليومي (تاريخ محدد)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all_dates')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'all_dates'
                ? 'bg-white text-indigo-900 shadow-sm border border-slate-200/80 ring-1 ring-indigo-500/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Search className="w-4 h-4 text-indigo-600" />
            <span>البحث الشامل في سجلات حضور وغياب الطالب (كل التواريخ)</span>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              {attendance.length} سجل
            </span>
          </button>
        </div>
      </div>

      {/* DAILY ATTENDANCE ROSTER VIEW */}
      {activeTab === 'daily' && (
        <>
      {/* Upper Control Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
        {/* Select Group & Date */}
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 space-y-4 md:col-span-2">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-850 text-base">دفتر التحضير وتسجيل الحضور اليومي</h3>
            <p className="text-slate-500 text-xs mt-1">تحديد المجموعة والتاريخ يدوياً أو بدء المسح الذكي الفوري لكروت المتعلمين.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">تصفية حسب الصف الدراسي</label>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  const newGrade = e.target.value;
                  setSelectedGrade(newGrade);
                  // Reset group selection if not compatible
                  if (newGrade !== 'الكل') {
                    const compatibleGroups = groups.filter(g => g.grade === newGrade);
                    if (!compatibleGroups.some(g => g.id === selectedGroupId)) {
                      setSelectedGroupId('الكل');
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all font-bold text-slate-800"
              >
                <option value="الكل">كل الصفوف الدراسية</option>
                {availableGrades.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">المجموعة الدراسية المستهدفة</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all font-bold text-slate-800"
              >
                <option value="الكل">كل مجموعات الصف</option>
                {groups
                  .filter(g => selectedGrade === 'الكل' || g.grade === selectedGrade)
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} - ({g.grade}) {g.isSpecial || g.type === 'special' ? '⭐ [خاصة]' : ''}
                    </option>
                  ))
                }
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">التاريخ واليوم المعتمد</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono outline-none transition-all font-bold text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* QR Scanner Trigger Card */}
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-sm flex items-center gap-1.5 text-white">
              <QrCode className="w-4 h-4 text-slate-300" />
              القارئ الذكي لكود الحضور
            </h4>
            <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
              استعمل كاميرا البث المباشر لمسح باركود الطالب لتسجيل دخوله وخروجه في ثانية بغير أي كتابة يدوية.
            </p>
          </div>

          <div>
            <button
              onClick={startCameraScanner}
              disabled={isCameraActive}
              className="w-full bg-white text-slate-905 bg-slate-50 text-slate-900 border border-slate-200 hover:bg-slate-100 font-bold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-slate-800" />
              تشغيل الكاميرا والمسح
            </button>
          </div>
        </div>
      </div>

      {/* QR CAMERA SCREEN OVERLAY CONTAINER */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4 text-center border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-900 text-sm">مسح الباركود بالكاميرا الحية</h4>
              <button onClick={stopCameraScanner} className="p-1 hover:bg-slate-105 rounded-lg text-slate-505 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <Volume2 className="w-4 h-4 text-emerald-600 animate-pulse" />
                التنبيه الصوتي المرتفع مفعل عند المسح 🔊
              </span>
              <button
                type="button"
                onClick={() => playQrScanAlertSound(false)}
                className="bg-emerald-600 text-white hover:bg-emerald-700 px-2.5 py-1 rounded-md font-bold text-[11px] transition"
              >
                تجربة الصوت
              </button>
            </div>

            <p className="text-xs text-slate-500">ضع رمز الـ QR Code الخاص بكارت الطالب أمام عدسة الكاميرا بوضوح تامة.</p>
            
            {/* Real Reader target */}
            <div id="qr-reader-container" className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 animate-pulse"></div>

            <button
              onClick={stopCameraScanner}
              className="w-full py-2 bg-red-50 text-red-650 hover:bg-red-100 font-bold text-xs rounded-lg border border-red-100 transition cursor-pointer"
            >
              إلغاء تشغيل الكاميرا
            </button>
          </div>
        </div>
      )}

      {/* Attendance stats summary - replacing simulation bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs text-right space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            تفاصيل الحضور للمجموعة
          </h4>
          <span className="text-xs text-slate-505 font-bold font-sans">تاريخ اليوم المعتمد: {selectedDate}</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-bold text-xs">
          <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg flex flex-col justify-between">
            <span className="text-slate-500 text-[11px] mb-1">إجمالي المقيدين</span>
            <strong className="text-slate-900 text-base font-sans">{totalRosterCount}</strong>
          </div>
          <div className="bg-emerald-50/75 border border-emerald-100 p-3 rounded-lg flex flex-col justify-between text-emerald-800">
            <span className="text-emerald-600 text-[11px] mb-1">الحاضرين</span>
            <strong className="text-emerald-700 text-base font-sans">{presentCount} <span className="text-[10px] text-emerald-600 font-normal">(منهم {lateCount} متأخر)</span></strong>
          </div>
          <div className="bg-red-50/75 border border-red-100 p-3 rounded-lg flex flex-col justify-between text-red-800">
            <span className="text-red-600 text-[11px] mb-1">الغائبين اليوم</span>
            <strong className="text-red-700 text-base font-sans">{absentCount}</strong>
          </div>
          <div className="bg-amber-50/75 border border-amber-100 p-3 rounded-lg flex flex-col justify-between text-amber-800">
            <span className="text-amber-600 text-[11px] mb-1">المستأذنين مسبقاً</span>
            <strong className="text-amber-700 text-base font-sans">{excusedCount}</strong>
          </div>
          <div className="bg-slate-900 text-white p-3 rounded-lg flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-slate-400 text-[11px] mb-1">نسبة الحضور</span>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-white text-base font-sans">{attendancePercentage}%</strong>
              <div className="w-16 bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full animate-pulse" style={{ width: `${attendancePercentage}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance interactive table registry */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/75 p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="font-bold text-slate-900 text-sm">
              سجل التحضير اليدوي: {selectedGroupId === 'الكل' ? (selectedGrade === 'الكل' ? 'كل الطلاب المقيدين' : `طلاب ${selectedGrade}`) : (activeGroup ? activeGroup.name : 'لا يوجد')}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Quick search inside list */}
              <div className="relative w-full sm:w-48 lg:w-64">
                <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="تصفية باسم الطالب المقيد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all"
                />
              </div>

              {selectedGroupId !== 'الكل' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFlexModalOpen(true);
                    setFlexStudentId('');
                    setFlexSearchQuery('');
                  }}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-650 animate-pulse" />
                  رصد حضور مرن / طالب زائر 🔄
                </button>
              )}

              {filteredGroupStudents.length > 0 && (
                <button
                  type="button"
                  id="mark-all-present-btn"
                  onClick={handleMarkAllPresent}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-600 hover:border-emerald-750"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  تسجيل الحضور للكل 🟢
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto text-right text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-600 font-bold border-b border-slate-200 text-right">
                  <th className="py-3 px-5">الكود</th>
                  <th className="py-3 px-5">اسم الطالب بالكامل</th>
                  <th className="py-3 px-5">توقيت الرصد الرقمي</th>
                  <th className="py-3 px-5">الحالة المالية</th>
                  <th className="py-3 px-5 text-center">رصد الحضور الفوري واليدوي</th>
                  <th className="py-3 px-5 text-center">التحكم والتواصل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroupStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      لا يوجد متعلمين مسجلي المجموعات متطابقين.
                    </td>
                  </tr>
                ) : (
                  filteredGroupStudents.map((s) => {
                    // Check if attendee already marked on school date
                    const todayRecord = attendance.find(a => a.studentId === s.id && a.date === selectedDate);
                    
                    // Month payment check
                    const currentMonth = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
                    const hasPaid = dbEngine.getPayments().some(p => p.studentId === s.id && p.month.includes(currentMonth.split(' ')[0]) && p.amountPaid >= p.amountDue);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-slate-900 font-bold">{s.code}</td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-bold text-slate-805 text-slate-800">{s.name}</div>
                            {selectedGroupId !== 'الكل' && s.groupId !== selectedGroupId && (
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-150 text-[9px] px-2 py-0.5 rounded-full font-extrabold" title="حضور مرن بديل اليوم">
                                حضور مرن 🔄 (الأساسية: {groups.find(g => g.id === s.groupId)?.name || 'غير محدد'})
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{s.school} - ({s.grade})</p>
                        </td>
                        <td className="py-3.5 px-5 text-slate-500 font-bold">
                          {todayRecord?.status === 'present' || todayRecord?.status === 'late' ? (
                            <div className="space-y-1">
                              <span className="text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-sans flex items-center gap-1 w-fit">
                                <LogIn className="w-3 h-3 text-slate-600" />
                                دخول: {todayRecord.checkInTime || 'غير مسجل'}
                              </span>
                              {todayRecord.checkOutTime && (
                                <span className="text-amber-800 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded font-sans flex items-center gap-1 w-fit">
                                  <LogOut className="w-3 h-3 text-amber-600" />
                                  انصراف: {todayRecord.checkOutTime}
                                </span>
                              )}
                            </div>
                          ) : todayRecord?.status === 'absent' ? (
                            <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded font-sans flex items-center gap-1 w-fit">غائب</span>
                          ) : todayRecord?.status === 'excused' ? (
                            <span className="text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-sans flex items-center gap-1 w-fit">مستأذن</span>
                          ) : (
                            <span className="text-slate-400 font-medium italic">بانتظار الرصد</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          {s.exemptionType === 'full' ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">إعفاء كلي مجاني</span>
                          ) : hasPaid ? (
                            <span className="text-[10px] font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">سداد الشهر موثق</span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-800 bg-red-50 border border-red-100 px-2 py-0.5 rounded animate-pulse">شهري معلق</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleMarkAttendance(s, 'present')}
                              className={`px-3 py-1.5 font-bold transition-all cursor-pointer ${
                                todayRecord?.status === 'present' 
                                  ? 'bg-slate-900 text-white' 
                                  : 'bg-white text-emerald-700 hover:bg-slate-50'
                              }`}
                            >
                              حاضر
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkAttendance(s, 'absent')}
                              className={`px-3 py-1.5 font-bold border-r border-slate-200 transition-all cursor-pointer ${
                                todayRecord?.status === 'absent' 
                                  ? 'bg-slate-900 text-white' 
                                  : 'bg-white text-red-650 hover:bg-slate-50'
                              }`}
                            >
                              غائب
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkAttendance(s, 'late')}
                              className={`px-3 py-1.5 font-bold border-r border-slate-200 transition-all cursor-pointer ${
                                todayRecord?.status === 'late' 
                                  ? 'bg-slate-900 text-white' 
                                  : 'bg-white text-amber-700 hover:bg-slate-50'
                              }`}
                            >
                              متأخر
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkAttendance(s, 'excused')}
                              className={`px-3 py-1.5 font-bold border-r border-slate-200 transition-all cursor-pointer ${
                                todayRecord?.status === 'excused' 
                                  ? 'bg-slate-900 text-white' 
                                  : 'bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              مستأذن
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('all_dates');
                                setHistorySelectedStudentId(s.id);
                                setHistorySearchQuery(s.name);
                              }}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs hover:shadow-sm"
                              title="عرض كافة تواريخ حضور وغياب الطالب دون تقيد بتاريخ اليوم"
                            >
                              <Search className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="text-[10px] font-bold hidden xl:inline">السجل الشامل</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenNotificationModal(s)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs hover:shadow-sm"
                              title="إرسال إشعار ولي الأمر"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-[10px] font-bold hidden xl:inline">تنبيه</span>
                            </button>

                            {todayRecord && (
                              <button
                                type="button"
                                onClick={() => setEditingAttendance({
                                  isOpen: true,
                                  student: s,
                                  record: todayRecord
                                })}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-750 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs hover:shadow-sm"
                                title="تعديل تفاصيل وأوقات الحضور"
                              >
                                <Edit className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-[10px] font-bold hidden xl:inline">تعديل</span>
                              </button>
                            )}

                            {todayRecord && (
                              confirmDeleteId === s.id ? (
                                <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 p-1 rounded-lg">
                                  <span className="text-[10px] text-red-700 font-bold px-1">تأكيد الحذف؟</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      dbEngine.deleteAttendance(todayRecord.id || `${s.id}_${selectedDate}`, s.id, selectedDate);
                                      setConfirmDeleteId(null);
                                      onRefresh();
                                    }}
                                    className="px-1.5 py-0.5 bg-red-600 text-white rounded font-bold text-[10px] hover:bg-red-700 cursor-pointer transition-colors"
                                  >
                                    نعم
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[10px] hover:bg-slate-300 cursor-pointer transition-colors"
                                  >
                                    لا
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(s.id)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs hover:shadow-sm"
                                  title="حذف وإلغاء هذا الحضور"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                  <span className="text-[10px] font-bold hidden xl:inline">حذف</span>
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* ALL DATES ATTENDANCE & ABSENCE HISTORY SEARCH VIEW */}
      {activeTab === 'all_dates' && (
        <div className="space-y-6 animate-in fade-in duration-200 text-right">
          {/* Header & Controls Panel */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Search className="w-5 h-5 text-indigo-600" />
                  البحث الشامل في سجلات حضور وغياب المتعلمين (كافة التواريخ)
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  البحث والاستعلام عن أي طالب ورصد حالة حضوره أو غيابه عبر كل التواريخ المسجلة بالمركز مع إمكانية التعديل السريع المباشر.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAddHistoryModalOpen(true);
                  setAddHistoryForm({
                    studentId: historySelectedStudentId !== 'all' ? historySelectedStudentId : (students[0]?.id || ''),
                    date: new Date().toISOString().split('T')[0],
                    groupId: selectedGroupId !== 'الكل' ? selectedGroupId : (groups[0]?.id || ''),
                    status: 'present',
                    checkInTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                    checkOutTime: ''
                  });
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة سجل حضور/غياب بتاريخ سابق ➕
              </button>
            </div>

            {/* Filter Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-right">
              {/* Search Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">البحث باسم الطالب أو الكود أو الهاتف</label>
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="اكتب اسم الطالب أو كوده..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 rounded-xl text-xs font-bold outline-none transition"
                  />
                </div>
              </div>

              {/* Student Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تحديد طالب محدد</label>
                <select
                  value={historySelectedStudentId}
                  onChange={(e) => setHistorySelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="all">كل المتعلمين ({students.length})</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - {s.grade}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تصفية حسب حالة الحضور والغياب</label>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="present">🟢 حاضر فقط</option>
                  <option value="late">⏰ متأخر فقط</option>
                  <option value="absent">🔴 غائب فقط</option>
                  <option value="excused">⚪ مستأذن فقط</option>
                </select>
              </div>

              {/* Group Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تصفية حسب المجموعة الدراسية</label>
                <select
                  value={historyGroupFilter}
                  onChange={(e) => setHistoryGroupFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="all">كل المجموعات الدراسية</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} - ({g.grade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تصفية حسب الشهر</label>
                <select
                  value={historyMonthFilter}
                  onChange={(e) => setHistoryMonthFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer text-indigo-700 font-black"
                >
                  <option value="all">كل الشهور</option>
                  <option value="سبتمبر">سبتمبر</option>
                  <option value="أكتوبر">أكتوبر</option>
                  <option value="نوفمبر">نوفمبر</option>
                  <option value="ديسمبر">ديسمبر</option>
                  <option value="يناير">يناير</option>
                  <option value="فبراير">فبراير</option>
                  <option value="مارس">مارس</option>
                  <option value="أبريل">أبريل</option>
                  <option value="مايو">مايو</option>
                  <option value="يونيو">يونيو</option>
                  <option value="يوليو">يوليو</option>
                  <option value="أغسطس">أغسطس</option>
                </select>
              </div>

              {/* Week Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تصفية حسب الأسبوع في الشهر</label>
                <select
                  value={historyWeekFilter}
                  onChange={(e) => setHistoryWeekFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer text-indigo-700 font-black bg-indigo-50/50"
                >
                  <option value="all">كل أسابيع الشهر</option>
                  <option value="1">الأسبوع الأول (الأيام 1 - 7)</option>
                  <option value="2">الأسبوع الثاني (الأيام 8 - 14)</option>
                  <option value="3">الأسبوع الثالث (الأيام 15 - 21)</option>
                  <option value="4">الأسبوع الرابع (الأيام 22 - 31)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Profile Card (if single student selected or found) */}
          {selectedStudentProfile && (
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-md">
                    كود الطالب: {selectedStudentProfile.code}
                  </span>
                  <h4 className="text-lg font-black text-white">{selectedStudentProfile.name}</h4>
                  <p className="text-xs text-slate-300">
                    الصف: <strong>{selectedStudentProfile.grade}</strong> — المجموعة الأساسية: <strong>{groups.find(g => g.id === selectedStudentProfile.groupId)?.name || 'غير محددة'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenNotificationModal(selectedStudentProfile)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    تنبيه ولي الأمر (WhatsApp)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistorySelectedStudentId('all');
                      setHistorySearchQuery('');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    عرض الكل
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <span className="text-slate-400 block text-[11px] mb-1">إجمالي الجلسات المسجلة</span>
                  <strong className="text-white text-base font-sans font-black">{filteredHistoryRecords.length} حصة</strong>
                </div>
                <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-800/50 text-emerald-200">
                  <span className="text-emerald-400 block text-[11px] mb-1">مرات الحضور والالتزام</span>
                  <strong className="text-emerald-300 text-base font-sans font-black">{historyPresentCount} حصة</strong>
                </div>
                <div className="bg-red-950/60 p-3 rounded-xl border border-red-800/50 text-red-200">
                  <span className="text-red-400 block text-[11px] mb-1">مرات الغياب بدون إذن</span>
                  <strong className="text-red-300 text-base font-sans font-black">{historyAbsentCount} حصة</strong>
                </div>
                <div className="bg-amber-950/60 p-3 rounded-xl border border-amber-800/50 text-amber-200">
                  <span className="text-amber-400 block text-[11px] mb-1">التأخير والاستئذان</span>
                  <strong className="text-amber-300 text-base font-sans font-black">{historyLateCount} تأخير / {historyExcusedCount} استئذان</strong>
                </div>
              </div>
            </div>
          )}

          {/* Table of Historical Attendance Records Across All Dates */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                نتائج سجلاَّت الحضور والغياب المحدثة ({filteredHistoryRecords.length} سجلاً متطابقاً)
              </h4>
              <span className="text-[11px] text-slate-500 font-bold">يمكنك تغيير حالة أي حصة فورياً بنقرة واحدة من جدول الإجراءات</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200 text-right">
                    <th className="py-3.5 px-4">التاريخ واليوم</th>
                    <th className="py-3.5 px-4">اسم المتعلم والكود</th>
                    <th className="py-3.5 px-4">المجموعة</th>
                    <th className="py-3.5 px-4">التوقيت (دخول/خروج)</th>
                    <th className="py-3.5 px-4 text-center">الحالة الحالية</th>
                    <th className="py-3.5 px-4 text-center">إجراءات التعديل والتحكم المباشرة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistoryRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-bold">
                        لا توجد سجلات حضور أو غياب مطابقة لخيارات البحث المحددة.
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryRecords.map(rec => {
                      const student = students.find(s => s.id === rec.studentId);
                      const group = groups.find(g => g.id === rec.groupId);
                      const arabicDay = getArabicDayName(rec.date);

                      return (
                        <tr key={rec.id || `${rec.studentId}_${rec.date}`} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-slate-900">{rec.date}</div>
                            <div className="text-[10px] text-slate-500 font-bold">{arabicDay}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{rec.studentName || student?.name || 'طالب غير معرّف'}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">كود: {student?.code || '—'} - ({student?.grade || '—'})</div>
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-700">
                            {group ? group.name : 'المجموعة الأساسية'}
                          </td>

                          <td className="py-3.5 px-4">
                            {rec.checkInTime ? (
                              <div className="space-y-0.5">
                                <span className="text-[11px] font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 block w-fit">
                                  دخول: {rec.checkInTime}
                                </span>
                                {rec.checkOutTime && (
                                  <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 block w-fit">
                                    خروج: {rec.checkOutTime}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">غير مسجل توقيت</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {rec.status === 'present' ? (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                حاضر
                              </span>
                            ) : rec.status === 'late' ? (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                متأخر
                              </span>
                            ) : rec.status === 'absent' ? (
                              <span className="bg-red-50 text-red-800 border border-red-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                غائب
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1">
                                <Info className="w-3.5 h-3.5 text-slate-500" />
                                مستأذن
                              </span>
                            )}
                          </td>

                          {/* Inline Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Quick status switch buttons */}
                              <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateHistoricalStatus(rec, 'present')}
                                  title="تغيير إلى حاضر"
                                  className={`px-2 py-1 text-[10.5px] font-bold transition cursor-pointer ${
                                    rec.status === 'present' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-slate-50'
                                  }`}
                                >
                                  حاضر
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateHistoricalStatus(rec, 'absent')}
                                  title="تغيير إلى غائب"
                                  className={`px-2 py-1 text-[10.5px] font-bold border-r border-slate-200 transition cursor-pointer ${
                                    rec.status === 'absent' ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-slate-50'
                                  }`}
                                >
                                  غائب
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateHistoricalStatus(rec, 'late')}
                                  title="تغيير إلى متأخر"
                                  className={`px-2 py-1 text-[10.5px] font-bold border-r border-slate-200 transition cursor-pointer ${
                                    rec.status === 'late' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-slate-50'
                                  }`}
                                >
                                  متأخر
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateHistoricalStatus(rec, 'excused')}
                                  title="تغيير إلى مستأذن"
                                  className={`px-2 py-1 text-[10.5px] font-bold border-r border-slate-200 transition cursor-pointer ${
                                    rec.status === 'excused' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  مستأذن
                                </button>
                              </div>

                              {/* Edit Full Details Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (student) {
                                    setEditingAttendance({
                                      isOpen: true,
                                      student,
                                      record: rec
                                    });
                                  }
                                }}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="تعديل تفاصيل الوقت والمجموعة"
                              >
                                <Edit className="w-3.5 h-3.5 text-blue-600" />
                                تعديل
                              </button>

                              {/* WhatsApp Notification */}
                              {student && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenNotificationModal(student)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="إرسال إشعار ولي الأمر"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                  تنبيه
                                </button>
                              )}

                              {/* Delete Record */}
                              {confirmDeleteId === rec.id ? (
                                <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 p-1 rounded-lg">
                                  <span className="text-[9px] text-red-700 font-bold">تأكيد؟</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      dbEngine.deleteAttendance(rec.id || `${rec.studentId}_${rec.date}`, rec.studentId, rec.date);
                                      setConfirmDeleteId(null);
                                      onRefresh();
                                    }}
                                    className="px-1.5 py-0.5 bg-red-600 text-white rounded font-bold text-[9px] hover:bg-red-700 cursor-pointer"
                                  >
                                    نعم
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-bold text-[9px] hover:bg-slate-300 cursor-pointer"
                                  >
                                    لا
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(rec.id)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="حذف هذا السجل"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                  حذف
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SCAN CONFIRMATION FLOATING TOAST */}
      {scanResult && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4">
          <div className={`bg-white rounded-2xl p-4.5 shadow-2xl border-2 text-right space-y-3 relative animate-in fade-in slide-in-from-top-4 duration-200 max-h-[85vh] overflow-y-auto ${
            scanResult.scheduleMismatch?.hasMismatch ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
          }`}>
            <button 
              onClick={() => setScanResult(null)}
              className="absolute left-3 top-3 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-3 justify-start">
              {scanResult.scheduleMismatch?.hasMismatch ? (
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center flex-shrink-0 animate-bounce">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
              ) : scanResult.status === 'success' ? (
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-800 border border-amber-100 flex items-center justify-center flex-shrink-0 animate-bounce">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">{scanResult.student.code}</span>
                <h4 className={`text-xs font-bold -mt-0.5 font-sans ${
                  scanResult.scheduleMismatch?.hasMismatch ? 'text-amber-700' : 'text-slate-500'
                }`}>
                  {scanResult.scheduleMismatch?.hasMismatch ? 'تنبيه: مسح في غير موعد أو توقيت الحضور!' : 'تم تسجيل الحضور بنجاح'}
                </h4>
                <p className="text-sm font-black text-slate-900 truncate mt-0.5">{scanResult.student.name}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-150 font-bold text-slate-700">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>توقيت المسح: <span className="font-mono text-slate-900">{scanResult.checkInTime}</span></span>
              </div>
              <div>
                الصف: <span className="text-slate-900">{scanResult.student.grade}</span>
              </div>
            </div>

            {/* SCHEDULE AND TIMING MISMATCH ALERT BOX & ACTIONS */}
            {scanResult.scheduleMismatch?.hasMismatch && (
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5 text-[11px] text-amber-950 font-bold text-right shadow-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs border-b border-amber-200/80 pb-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 animate-bounce" />
                  <span>تفاصيل اختلاف الموعد أو التوقيت الممسوح:</span>
                </div>
                
                <div className="space-y-1 text-amber-900 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200/60 text-[10.5px]">
                  {scanResult.scheduleMismatch.reasons.map((reason, idx) => (
                    <p key={idx} className="flex items-start gap-1">
                      <span className="text-amber-600 font-black flex-shrink-0">•</span>
                      <span>{reason}</span>
                    </p>
                  ))}
                </div>

                <div className="text-[10.5px] text-slate-700 bg-white p-2 rounded-lg border border-amber-200 space-y-1">
                  <div>المجموعة الرسمية: <strong className="text-slate-900">{scanResult.scheduleMismatch.officialGroupName}</strong> ({scanResult.scheduleMismatch.officialGroupTime})</div>
                  <div>الأيام المعتمدة: <strong className="text-slate-900">{scanResult.scheduleMismatch.officialGroupDays.join('، ') || 'غير محددة'}</strong></div>
                </div>

                {/* ACTION BUTTONS FOR MISMATCH */}
                <div className="pt-2 border-t border-amber-200 space-y-2">
                  <span className="block text-[10.5px] font-black text-slate-800">إجراءات المعالجة المناسبة:</span>
                  
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={handleConfirmFlexAttendance}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                      اعتماد كـ (حضور مرن / طالب زائر) 🟢
                    </button>

                    {scanResult.scheduleMismatch.isWrongGroup && selectedGroupId && selectedGroupId !== 'الكل' && (
                      <button
                        type="button"
                        onClick={handleTransferStudentGroup}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-white" />
                        نقل الطالب رسمياً لـ "{scanResult.scheduleMismatch.activeGroupName}" 🔄
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={handleMarkLateException}
                        className="py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10.5px] flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        تسجيل كمتأخر ⏰
                      </button>

                      <button
                        type="button"
                        onClick={handleSendMismatchWhatsApp}
                        className="py-1.5 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-[10.5px] flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        تنبيه ولي الأمر 💬
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCancelScanAttendance}
                      className="w-full py-1.5 px-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-[10.5px] flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      إلغاء والتراجع عن تسجيل الحضور ❌
                    </button>
                  </div>
                </div>
              </div>
            )}

            {scanResult.paymentStatus === 'not_paid' ? (
              <div className="p-2.5 bg-red-50 text-red-800 border border-red-100 rounded-lg text-[10.5px] font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-650" />
                <span>تحذير مالي: الاشتراك غير مسدد! 💸</span>
              </div>
            ) : scanResult.paymentStatus === 'exempt' ? (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-[10.5px] font-bold">
                المتعلم مستحق الدعم ومعفي من الرسوم 💚
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 text-slate-700 border border-slate-150 rounded-lg text-[10.5px] font-bold">
                الرسوم مسددة بالكامل مكتمل ✅
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCAN ERROR FLOATING TOAST */}
      {scanErrorMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
          <div className="bg-white rounded-2xl p-4 shadow-2xl border-2 border-red-200 text-right space-y-3 relative animate-in fade-in slide-in-from-top-4 duration-200">
            <button 
              onClick={() => setScanErrorMessage(null)}
              className="absolute left-3 top-3 p-1 bg-red-50 hover:bg-red-100 border border-red-150 text-red-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-3 justify-start">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-800 border border-red-100 flex items-center justify-center flex-shrink-0 animate-pulse">
                <AlertCircle className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-red-600 font-sans">فشل قراءة رمز الكارت</h4>
                <p className="text-xs font-bold text-slate-650 leading-relaxed mt-1">{scanErrorMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL WHATSAPP NOTIFICATION MODAL */}
      {notificationModal.isOpen && notificationModal.student && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 text-right">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <button 
              onClick={() => setNotificationModal(prev => ({ ...prev, isOpen: false, student: null }))}
              className="absolute left-4 top-4 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 justify-end">
                <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
                إرسال إشعار ولي الأمر الذكي (WhatsApp)
              </h3>
              <p className="text-slate-500 text-[11px]">
                إرسال إشعارات مخصصة أو عامة ببيانات الطالب: <strong className="text-slate-800">{notificationModal.student.name}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-bold text-slate-600 block">اختر قالب التنبيه المطلوب</label>
                <select
                  value={notificationModal.templateType}
                  onChange={(e) => handleTemplateTypeChange(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl text-xs font-bold outline-none transition cursor-pointer"
                >
                  <option value="attendance">✅ حضور الطالب اليوم</option>
                  <option value="checkout">🚶‍♂️ انصراف وخروج الطالب</option>
                  <option value="absence">⚠️ غياب الطالب عن الحصة</option>
                  <option value="payment_reminder">🧾 تذكير بالمصروفات الشهرية</option>
                  <option value="announcement">📢 إعلان عام للمجموعة</option>
                  <option value="custom">✍️ إشعار مخصص حر (مخصوص)</option>
                </select>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-xs font-bold text-slate-600 block">رقم هاتف المستلم (ولي الأمر)</label>
                <input
                  type="text"
                  readOnly
                  value={notificationModal.student.parentPhone}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none text-left cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-600 block">محتوى رسالة الـ WhatsApp التنبيهية</label>
              <textarea
                rows={5}
                value={notificationModal.messageText}
                onChange={(e) => setNotificationModal(prev => ({ ...prev, messageText: e.target.value }))}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl text-xs outline-none transition text-right leading-relaxed font-sans"
              />
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-[10.5px] leading-relaxed flex items-start gap-2 text-emerald-900 font-medium">
              <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                تلقائياً، يتم ملء المتغيرات بسجلات الطالب مثل الاسم والمجموعة والتاريخ والوقت لتسهيل صياغة الإشعار قبل إرساله.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleSendWhatsAppNotification}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
                توجيه وإرسال عبر WhatsApp
              </button>
              <button
                onClick={() => setNotificationModal(prev => ({ ...prev, isOpen: false, student: null }))}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDITING ATTENDANCE MODAL */}
      {editingAttendance && editingAttendance.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-right space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <button 
              onClick={() => setEditingAttendance(null)}
              className="absolute left-4 top-4 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-black text-slate-900 font-sans">تعديل سجل حضور الطالب</h3>
              <p className="text-xs text-slate-500 mt-1">
                تعديل الحالات وتوقيتات الدخول والخروج للطالب: <strong className="text-slate-800">{editingAttendance.student.name}</strong>
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Status Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة الحضور</label>
                <select
                  value={editingAttendance.record.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as 'present' | 'absent' | 'late' | 'excused';
                    setEditingAttendance(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        record: {
                          ...prev.record,
                          status: newStatus
                        }
                      };
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs outline-none font-bold"
                >
                  <option value="present">حاضر (Present)</option>
                  <option value="absent">غائب (Absent)</option>
                  <option value="late">متأخر (Late)</option>
                  <option value="excused">مستأذن (Excused)</option>
                </select>
              </div>

              {/* Group reassign select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">المجموعة الدراسية الحالية لهذه الحصة</label>
                <select
                  value={editingAttendance.record.groupId}
                  onChange={(e) => {
                    const newGroupId = e.target.value;
                    setEditingAttendance(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        record: {
                          ...prev.record,
                          groupId: newGroupId
                        }
                      };
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs outline-none font-bold"
                >
                  {groups
                    .filter(g => g.grade === editingAttendance.student.grade)
                    .map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.id === editingAttendance.student.groupId ? '⭐️ (المجموعة الأساسية)' : '🔄 (حضور بديل)'}
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Check-In Time input */}
              {(editingAttendance.record.status === 'present' || editingAttendance.record.status === 'late') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">وقت الحضور (الدخول)</label>
                    <input
                      type="text"
                      placeholder="مثال: 04:30 م"
                      value={editingAttendance.record.checkInTime || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingAttendance(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            record: {
                              ...prev.record,
                              checkInTime: val
                            }
                          };
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-mono font-bold text-left outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">وقت الانصراف (الخروج)</label>
                    <input
                      type="text"
                      placeholder="مثال: 06:00 م"
                      value={editingAttendance.record.checkOutTime || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingAttendance(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            record: {
                              ...prev.record,
                              checkOutTime: val || undefined
                            }
                          };
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-mono font-bold text-left outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  dbEngine.addAttendance(editingAttendance.record);
                  setEditingAttendance(null);
                  onRefresh();
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                حفظ التعديلات
              </button>
              <button
                onClick={() => setEditingAttendance(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLEXIBLE ATTENDANCE / GUEST CHECK-IN MODAL */}
      {isFlexModalOpen && selectedGroupId !== 'الكل' && activeGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-right space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <button 
              onClick={() => setIsFlexModalOpen(false)}
              className="absolute left-4 top-4 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-indigo-50 text-indigo-700 p-2 rounded-lg border border-indigo-100">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                </div>
                <h3 className="text-base font-black text-slate-900 font-sans">رصد حضور مرن (طالب زائر)</h3>
              </div>
              <p className="text-xs text-slate-500">
                يمكنك هنا رصد حضور طالب من مجموعة أخرى لحصة اليوم في مجموعة: <strong className="text-indigo-700 font-bold">{activeGroup.name}</strong> ({activeGroup.grade})
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Search input to find visitor student */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">البحث عن الطالب (بالاسم أو الكود)</label>
                <div className="relative">
                  <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="اكتب كود أو اسم طالب من مجموعة أخرى..."
                    value={flexSearchQuery}
                    onChange={(e) => {
                      setFlexSearchQuery(e.target.value);
                      setFlexStudentId(''); // reset selection if query changes
                    }}
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-right outline-none transition-all"
                  />
                </div>
              </div>

              {/* Candidates list */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">اختر الطالب من النتائج المطابقة لـ ({activeGroup.grade})</label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1">
                  {(() => {
                    const candidates = students.filter(s => {
                      if (s.status !== 'approved') return false;
                      if (s.grade !== activeGroup.grade) return false;
                      
                      // Cannot be primary or already configured as alternative (since those already show in main table)
                      const isPrimary = s.groupId === selectedGroupId;
                      const isAlternative = s.alternativeGroupIds && s.alternativeGroupIds.includes(selectedGroupId);
                      if (isPrimary || isAlternative) return false;

                      // Match query
                      if (flexSearchQuery) {
                        const q = flexSearchQuery.trim().toLowerCase();
                        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
                      }
                      return true; // show all same grade approved students by default if query is empty
                    });

                    if (candidates.length === 0) {
                      return <p className="text-center text-[11px] text-slate-400 italic py-6">لا يوجد طلاب مطابقين للبحث من نفس الصف.</p>;
                    }

                    return candidates.map(cand => {
                      const candGroup = groups.find(g => g.id === cand.groupId);
                      const isSelected = flexStudentId === cand.id;
                      return (
                        <div
                          key={cand.id}
                          onClick={() => setFlexStudentId(cand.id)}
                          className={`p-2.5 rounded-lg border text-right cursor-pointer transition-all flex items-center justify-between text-xs ${
                            isSelected 
                              ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' 
                              : 'bg-white hover:bg-indigo-50/30 border-slate-200/80 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800">{cand.name}</span>
                              <span className="text-[10px] text-slate-400 block">كود: {cand.code} — المجموعة الأساسية: {candGroup ? candGroup.name : 'غير محدد'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Status Select */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة حضور الزائر</label>
                  <select
                    value={flexStatus}
                    onChange={(e) => setFlexStatus(e.target.value as 'present' | 'late')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs outline-none font-bold"
                  >
                    <option value="present">حاضر (Present)</option>
                    <option value="late">متأخر (Late)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ الحصة</label>
                  <input
                    type="date"
                    disabled
                    value={selectedDate}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-left outline-none cursor-not-allowed text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={!flexStudentId}
                onClick={() => {
                  const student = students.find(s => s.id === flexStudentId);
                  if (!student) return;
                  const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                  dbEngine.addAttendance({
                    id: `${student.id}_${selectedDate}`,
                    studentId: student.id,
                    studentName: student.name,
                    groupId: selectedGroupId,
                    date: selectedDate,
                    status: flexStatus,
                    checkInTime: timeNow
                  });
                  setIsFlexModalOpen(false);
                  setFlexStudentId('');
                  onRefresh();
                }}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  flexStudentId 
                    ? 'bg-indigo-650 hover:bg-indigo-700 text-white shadow-sm' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                رصد وتأكيد الحضور المرن
              </button>
              <button
                type="button"
                onClick={() => setIsFlexModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETROACTIVE ATTENDANCE ADDITION MODAL */}
      {isAddHistoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-right space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <button 
              onClick={() => setIsAddHistoryModalOpen(false)}
              className="absolute left-4 top-4 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                إضافة أو رصد حضور/غياب بتاريخ سابق
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                رصد وتوثيق حالة حضور أو غياب أي طالب في أي تاريخ سابق بغير التقيد بتاريخ اليوم.
              </p>
            </div>

            <div className="space-y-3.5 pt-2">
              {/* Select Student */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اختر الطالب المستهدف</label>
                <select
                  value={addHistoryForm.studentId}
                  onChange={(e) => {
                    const studentId = e.target.value;
                    const student = students.find(s => s.id === studentId);
                    setAddHistoryForm(prev => ({
                      ...prev,
                      studentId,
                      groupId: student ? student.groupId : prev.groupId
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="">-- اختر طالباً --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - {s.grade}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Date & Group */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ المستهدف</label>
                  <input
                    type="date"
                    value={addHistoryForm.date}
                    onChange={(e) => setAddHistoryForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-mono font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المجموعة</label>
                  <select
                    value={addHistoryForm.groupId}
                    onChange={(e) => setAddHistoryForm(prev => ({ ...prev, groupId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="">-- اختر مجموعة --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.grade})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Select Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حالة الحضور</label>
                <select
                  value={addHistoryForm.status}
                  onChange={(e) => setAddHistoryForm(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="present">🟢 حاضر (Present)</option>
                  <option value="late">⏰ متأخر (Late)</option>
                  <option value="absent">🔴 غائب (Absent)</option>
                  <option value="excused">⚪ مستأذن (Excused)</option>
                </select>
              </div>

              {/* Times */}
              {(addHistoryForm.status === 'present' || addHistoryForm.status === 'late') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">توقيت الدخول</label>
                    <input
                      type="text"
                      placeholder="04:00 م"
                      value={addHistoryForm.checkInTime}
                      onChange={(e) => setAddHistoryForm(prev => ({ ...prev, checkInTime: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">توقيت الخروج (اختياري)</label>
                    <input
                      type="text"
                      placeholder="06:00 م"
                      value={addHistoryForm.checkOutTime}
                      onChange={(e) => setAddHistoryForm(prev => ({ ...prev, checkOutTime: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={!addHistoryForm.studentId || !addHistoryForm.date}
                onClick={() => {
                  const student = students.find(s => s.id === addHistoryForm.studentId);
                  if (!student) return;

                  dbEngine.addAttendance({
                    id: `${student.id}_${addHistoryForm.date}`,
                    studentId: student.id,
                    studentName: student.name,
                    groupId: addHistoryForm.groupId || student.groupId,
                    date: addHistoryForm.date,
                    status: addHistoryForm.status,
                    checkInTime: (addHistoryForm.status === 'present' || addHistoryForm.status === 'late') ? addHistoryForm.checkInTime : undefined,
                    checkOutTime: addHistoryForm.checkOutTime || undefined
                  });

                  setIsAddHistoryModalOpen(false);
                  onRefresh();
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  addHistoryForm.studentId && addHistoryForm.date
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                حفظ وإضافة السجل
              </button>
              <button
                type="button"
                onClick={() => setIsAddHistoryModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
