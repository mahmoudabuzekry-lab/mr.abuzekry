/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { dbEngine } from '../db';
import { Student, Group, Attendance } from '../types';
import { 
  Calendar, Users, QrCode, Camera, CheckCircle2, AlertTriangle, 
  Clock, X, Search, Check, AlertCircle, HelpCircle, LogIn, LogOut,
  MessageSquare, Sparkles, Send, Info, Trash2, Edit
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface AttendanceManagerProps {
  students: Student[];
  groups: Group[];
  attendance: Attendance[];
  onRefresh: () => void;
}

export default function AttendanceManager({ students, groups, attendance, onRefresh }: AttendanceManagerProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>('الكل');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('الكل');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // State for Editing Attendance Record
  const [editingAttendance, setEditingAttendance] = useState<{
    isOpen: boolean;
    student: Student;
    record: Attendance;
  } | null>(null);

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
  
  // Custom QR Scan Overlay state
  const [scanResult, setScanResult] = useState<{
    student: Student;
    status: 'success' | 'warning';
    paymentStatus: 'paid' | 'not_paid' | 'exempt';
    checkInTime?: string;
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
      dbEngine.addAttendance({
        id: `${student.id}_${selectedDate}`,
        studentId: student.id,
        studentName: student.name,
        groupId: student.groupId,
        date: selectedDate,
        status,
        checkInTime: (status === 'present' || status === 'late') ? timeNow : undefined
      });
    }
    
    onRefresh();
  };

  // Process a scanned / mock barcode student ID
  const processStudentQrScan = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
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
      dbEngine.addAttendance({
        id: `${student.id}_${todayStr}`,
        studentId: student.id,
        studentName: student.name,
        groupId: student.groupId,
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

    setScanResult({
      student,
      status,
      paymentStatus,
      checkInTime
    });

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      setScanResult(null);
    }, 1800);

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
    
    // Group filter
    if (selectedGroupId !== 'الكل' && s.groupId !== selectedGroupId) return false;
    
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="attendance-manager">
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
                    <option key={g.id} value={g.id}>{g.name} - ({g.grade})</option>
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

      {/* ADMIN SIMULATION BAR FOR QR TESTING */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-right">
        <div className="flex items-center gap-2 justify-start">
          <HelpCircle className="w-4 h-4 text-slate-600" />
          <h4 className="font-bold text-xs text-slate-800">منصة محاكاة كود كروت الطلاب (لتجربة الـ QR بغير كاميرا فعلية)</h4>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          بما أنك بحاجة لتجربة الكود في بيئة الحوسبة، انقر مباشرة على "مسح العضوية" لأي طالب لتسجيل حضوره كأنك مسحت رمزه QR فعلاً!
        </p>
        <div className="flex flex-wrap gap-2 justify-start">
          {students.filter(s => s.status === 'approved').slice(0, 5).map(s => {
            const isTodayChecked = attendance.find(a => a.studentId === s.id && a.date === new Date().toISOString().split('T')[0]);
            
            return (
              <button
                key={s.id}
                onClick={() => processStudentQrScan(s.id)}
                className={`px-3 py-1.5 border rounded-lg text-[10.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isTodayChecked 
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100' 
                    : 'bg-white text-slate-800 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                محاكاة مسح: {s.name.split(' ')[0]} {s.name.split(' ')[1] || ''}
                {isTodayChecked && (
                  <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-sans">
                    حاضر
                  </span>
                )}
              </button>
            );
          })}
          {students.filter(s => s.status === 'approved').length > 5 && (
            <span className="text-xs text-slate-400 self-center">... ومتوفر {students.filter(s => s.status === 'approved').length - 5} طالب آخر بالسجلات</span>
          )}
        </div>
      </div>

      {/* Stats and Group Attendance table */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-right">
        {/* Attendance stats summary */}
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 space-y-4 h-fit">
          <h4 className="font-bold text-sm text-slate-800 border-b border-slate-105 pb-3">تفاصيل الحضور للمجموعة</h4>
          
          <div className="space-y-3 font-bold text-xs text-slate-600">
            <div className="flex justify-between items-center bg-slate-50/70 py-2 px-3 rounded-lg border border-slate-100">
              <span>إجمالي المقيدين</span>
              <strong className="text-slate-805 text-slate-900 text-sm font-sans">{totalRosterCount}</strong>
            </div>
            <div className="flex justify-between items-center bg-emerald-50/70 py-2 px-3 rounded-lg border border-emerald-100 text-emerald-800">
              <span>حاضرين المسجلين</span>
              <strong className="text-emerald-850 font-sans text-sm">{presentCount} (متأخر: {lateCount})</strong>
            </div>
            <div className="flex justify-between items-center bg-red-50/70 py-2 px-3 rounded-lg border border-red-100 text-red-850">
              <span>الغائبين اليوم</span>
              <strong className="text-red-750 font-sans text-sm">{absentCount}</strong>
            </div>
            <div className="flex justify-between items-center bg-amber-50/70 py-2 px-3 rounded-lg border border-amber-100 text-amber-850">
              <span>المستأذنين مسبقاً</span>
              <strong className="text-amber-750 font-sans text-sm">{excusedCount}</strong>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-105 text-center">
            <p className="text-xs text-slate-450 text-slate-500">نسبة التحضير الإجمالية للمجموعة</p>
            <h5 className="text-2xl font-bold text-slate-900 font-sans mt-1.5">{attendancePercentage}%</h5>
            {/* Util Progress line */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2.5">
              <div className="bg-slate-900 h-full rounded-full" style={{ width: `${attendancePercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Attendance interactive table registry */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden md:col-span-3">
          <div className="bg-slate-50/75 p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="font-bold text-slate-900 text-sm">
              سجل التحضير اليدوي: {selectedGroupId === 'الكل' ? (selectedGrade === 'الكل' ? 'كل الطلاب المقيدين' : `طلاب ${selectedGrade}`) : (activeGroup ? activeGroup.name : 'لا يوجد')}
            </div>
            
            {/* Quick search inside list */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="تصفية باسم الطالب المقيد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all"
              />
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
                          <div className="font-bold text-slate-805 text-slate-800">{s.name}</div>
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
      </div>

      {/* SCAN CONFIRMATION FLOATING TOAST */}
      {scanResult && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
          <div className="bg-white rounded-2xl p-4 shadow-2xl border-2 border-slate-200 text-right space-y-3 relative animate-in fade-in slide-in-from-top-4 duration-200">
            <button 
              onClick={() => setScanResult(null)}
              className="absolute left-3 top-3 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-3 justify-start">
              {scanResult.status === 'success' ? (
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
                <h4 className="text-xs font-bold text-slate-500 -mt-0.5 font-sans">تم تسجيل الحضور بنجاح</h4>
                <p className="text-sm font-black text-slate-900 truncate mt-0.5">{scanResult.student.name}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-150 font-bold text-slate-700">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>توقيت الدخول: <span className="font-mono text-slate-900">{scanResult.checkInTime}</span></span>
              </div>
              <div>
                الصف: <span className="text-slate-900">{scanResult.student.grade}</span>
              </div>
            </div>

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
    </div>
  );
}
