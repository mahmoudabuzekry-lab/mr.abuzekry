/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { dbEngine } from '../db';
import { Student, Group, Attendance } from '../types';
import { 
  Calendar, Users, QrCode, Camera, CheckCircle2, AlertTriangle, 
  Clock, X, Search, Check, AlertCircle, HelpCircle, LogIn, LogOut
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface AttendanceManagerProps {
  students: Student[];
  groups: Group[];
  attendance: Attendance[];
  onRefresh: () => void;
}

export default function AttendanceManager({ students, groups, attendance, onRefresh }: AttendanceManagerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom QR Scan Overlay state
  const [scanResult, setScanResult] = useState<{
    student: Student;
    status: 'success' | 'warning' | 'checkout';
    paymentStatus: 'paid' | 'not_paid' | 'exempt';
    checkInTime?: string;
    checkOutTime?: string;
  } | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  // Active camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Set default group on mount
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups]);

  // Handle manual attendance toggle
  const handleMarkAttendance = (student: Student, status: 'present' | 'absent' | 'late' | 'excused') => {
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
    
    onRefresh();
  };

  // Process a scanned / mock barcode student ID
  const processStudentQrScan = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      setScanErrorMessage('عذراً، كود الطالب الممسوح غير مطابق لأي سجل أو قد يكون تالفاً!');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    
    // Check if attendance already exists for today
    const existingRecord = attendance.find(a => a.studentId === student.id && a.date === todayStr);
    
    let status: 'success' | 'warning' | 'checkout' = 'success';
    let checkInTime = timeNow;
    let checkOutTime: string | undefined = undefined;

    if (existingRecord && existingRecord.status === 'present') {
      // Second scan = Check-out
      dbEngine.addAttendance({
        ...existingRecord,
        checkOutTime: timeNow
      });
      status = 'checkout';
      checkInTime = existingRecord.checkInTime || timeNow;
      checkOutTime = timeNow;
    } else {
      // First scan = Present
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
      
      if (paymentStatus === 'not_paid' && status === 'success') {
        status = 'warning'; // highlight missing payment!
      }
    }

    setScanResult({
      student,
      status,
      paymentStatus,
      checkInTime,
      checkOutTime
    });

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
            // Success: process scanned text (should be student.id)
            processStudentQrScan(decodedText);
            // Stop scanning and turn off camera
            stopCameraScanner();
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
    };
  }, []);

  // Filter students showing the active selected grade/group roster
  const activeGroup = groups.find(g => g.id === selectedGroupId);
  const groupStudents = students.filter(s => s.status === 'approved' && s.groupId === selectedGroupId);
  
  const filteredGroupStudents = groupStudents.filter(s => 
    s.name.includes(searchQuery) || s.code.includes(searchQuery)
  );

  // Group attendance stats
  const activeAttendanceForGroup = attendance.filter(a => a.groupId === selectedGroupId && a.date === selectedDate);
  const presentCount = activeAttendanceForGroup.filter(a => a.status === 'present' || a.status === 'late').length;
  const absentCount = activeAttendanceForGroup.filter(a => a.status === 'absent').length;
  const lateCount = activeAttendanceForGroup.filter(a => a.status === 'late').length;
  const excusedCount = activeAttendanceForGroup.filter(a => a.status === 'excused').length;
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-705 text-slate-700 mb-1.5">المجموعة الدراسية المستهدفة</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} - ({g.grade})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">التاريخ واليوم المعتمد</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono outline-none transition-all"
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
          بما أنك بحاجة لتجربة الكود في بيئة الحوسبة، انقر مباشرة على "مسح العضوية" لأي طالب لتسجيل حضوره أو انصرافه كأنك مسحت رمزه QR فعلاً!
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
                    ? isTodayChecked.checkOutTime 
                      ? 'bg-slate-100 text-slate-500 border-slate-200' 
                      : 'bg-indigo-50 text-indigo-805 text-indigo-800 border-indigo-200 hover:bg-indigo-100' 
                    : 'bg-white text-slate-800 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                محاكاة مسح: {s.name.split(' ')[0]} {s.name.split(' ')[1] || ''}
                {isTodayChecked && (
                  <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-sans">
                    {isTodayChecked.checkOutTime ? 'خروج' : 'دخول'}
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
            <div className="font-bold text-slate-900 text-sm">سجل التحضير اليدوي: {activeGroup ? activeGroup.name : 'لا يوجد'}</div>
            
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroupStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
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
                          <p className="text-[10px] text-slate-400 mt-0.5">{s.school}</p>
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SCAN CONFIRMATION OVERLAY POPUP */}
      {scanResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-100 border border-slate-200">
            <button 
              onClick={() => setScanResult(null)}
              className="absolute left-4 top-4 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon status switch */}
            {scanResult.status === 'success' ? (
              <div className="w-16 h-16 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            ) : scanResult.status === 'checkout' ? (
              <div className="w-16 h-16 bg-slate-100 text-slate-900 border border-slate-200 rounded-full flex items-center justify-center mx-auto">
                <LogOut className="w-8 h-8" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-amber-50 text-amber-800 border border-amber-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}

            <div>
              <span className="text-xs font-bold text-slate-450 text-slate-400 font-mono tracking-wider">{scanResult.student.code}</span>
              <h3 className="text-base font-bold text-slate-900 font-sans mt-0.5">
                {scanResult.status === 'checkout' ? 'حالة تسجيل انصراف الطالب' : 'حالة تسجيل دخول الطالب'}
              </h3>
              <p className="text-base font-bold text-slate-950 leading-snug mt-1.5">{scanResult.student.name}</p>
              <p className="text-xs text-slate-500 mt-1">الصف: {scanResult.student.grade} - {groups.find(g => g.id === scanResult.student.groupId)?.name || 'مجموعتك'}</p>
            </div>

            {/* Attendance detailed row */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex flex-col justify-center items-center text-xs space-y-1 font-bold">
              <div className="flex items-center gap-1.5 text-slate-700">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>وقت رصد الحضور:</span>
                <strong className="text-slate-900 font-sans">{scanResult.checkInTime}</strong>
              </div>
              {scanResult.checkOutTime && (
                <div className="flex items-center gap-1.5 text-slate-705 pt-1.5 border-t border-slate-200 mt-1 w-full justify-center text-slate-700">
                  <Clock className="w-4 h-4 text-slate-505" />
                  <span>وقت رصد الخروج اليوم:</span>
                  <strong className="text-slate-905 font-sans">{scanResult.checkOutTime}</strong>
                </div>
              )}
            </div>

            {/* Financial status alert warning */}
            {scanResult.paymentStatus === 'not_paid' ? (
              <div className="p-3 bg-red-50 text-red-800 border border-red-100 rounded-lg text-xs space-y-1">
                <div className="font-bold flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-650" />
                  تحذير مالي من الدفتر: الاشتراك غير مسدد!
                </div>
                <p className="text-[10px] text-slate-500">يرجى توجيه الطالب لمراجعة الحسابات ودفع مصروفات الشهر المترتبة.</p>
              </div>
            ) : scanResult.paymentStatus === 'exempt' ? (
              <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-110 border-emerald-100 rounded-lg text-xs font-bold">
                المتعلم مستحق الدعم ومعفي تمامًا من الرسوم الشهري.
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-bold">
                تم التحقق من الدفتر وسداد الرسوم الشهري مكتمل تماماً ✅
              </div>
            )}

            <button
              onClick={() => setScanResult(null)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-lg text-xs transition cursor-pointer"
            >
              مفهوم وإغلاق الإشعار
            </button>
          </div>
        </div>
      )}

      {/* SCAN ERROR POPUP */}
      {scanErrorMessage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-100 border border-slate-200">
            <button 
              onClick={() => setScanErrorMessage(null)}
              className="absolute left-4 top-4 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 bg-red-50 text-red-800 border border-red-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">
                فشل في قراءة رمز الكارت
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                {scanErrorMessage}
              </p>
            </div>

            <button
              onClick={() => setScanErrorMessage(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-lg text-xs transition cursor-pointer"
            >
              الرجوع والمحاولة مرة أخرى
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
