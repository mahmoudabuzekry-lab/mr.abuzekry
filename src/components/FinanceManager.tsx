/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbEngine } from '../db';
import { Student, Payment, GradeType, ExemptionType, doesMonthPrecedeDate, getCurrentArabicMonthName } from '../types';
import { 
  DollarSign, Landmark, Filter, Search, Plus, Trash2, Printer, X, Download, 
  Settings, Check, TrendingUp, AlertTriangle, User, Calendar, Receipt, FileText, AlertCircle, ShieldAlert, CheckCircle,
  Cloud, CloudOff, RefreshCw, Wifi, WifiOff, Server, Database,
  QrCode, Camera, HelpCircle, CheckCircle2
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import { testConnection, getPendingQueue, fetchEntityFromFirebase } from '../firebase';

interface FinanceManagerProps {
  students: Student[];
  payments: Payment[];
  prices: Record<GradeType, number>;
  onRefresh: () => void;
}

export default function FinanceManager({ students, payments, prices, onRefresh }: FinanceManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'add' | 'debtors' | 'prices' | 'blankSheet'>('debtors');
  
  // Cloud Sync tracking states
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [cloudPaymentsCount, setCloudPaymentsCount] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const checkFinancialSyncStatus = async () => {
    try {
      const online = await testConnection();
      setIsOnline(online);
      
      const queue = getPendingQueue();
      const paymentQueueItems = queue.filter(item => item.entityKey === 'payments').length;
      setPendingQueueCount(paymentQueueItems);

      if (online) {
        const cPayments = await fetchEntityFromFirebase('payments');
        if (cPayments && cPayments.items) {
          setCloudPaymentsCount(cPayments.items.length);
        } else {
          setCloudPaymentsCount(0);
        }
      } else {
        setCloudPaymentsCount(null);
      }
    } catch (err: any) {
      console.warn("Failed to fetch financial sync stats:", err);
      setSyncError("فشل استعلام مطابقة الدفاتر المالية سحابياً.");
    }
  };

  useEffect(() => {
    checkFinancialSyncStatus();

    const handleSyncUpdate = () => {
      checkFinancialSyncStatus();
    };

    window.addEventListener('abuzekry_sync_status_updated', handleSyncUpdate);
    window.addEventListener('abuzekry_sync_completed', handleSyncUpdate);
    return () => {
      window.removeEventListener('abuzekry_sync_status_updated', handleSyncUpdate);
      window.removeEventListener('abuzekry_sync_completed', handleSyncUpdate);
    };
  }, [payments]);

  const handleForceSyncFinance = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    setSyncError(null);
    try {
      const online = await testConnection();
      if (!online) {
        setSyncError("الجهاز غير متصل بالإنترنت حالياً. سيتم حفظ العمليات محلياً وإرسالها عند توفر الشبكة.");
        setIsSyncing(false);
        return;
      }

      if (!dbEngine.isFirebaseEnabled()) {
        setSyncError("الربط السحابي غير مفعل حالياً. يمكنك تفعيله من صفحة النسخ الاحتياطي.");
        setIsSyncing(false);
        return;
      }

      await dbEngine.syncAllToFirebase();
      setSyncFeedback("تم مزامنة ومطابقة الدفاتر المالية والاشتراكات بنجاح مع السيرفر السحابي! ✨");
      await checkFinancialSyncStatus();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setSyncError(`فشلت مزامنة الدفاتر: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncFeedback(null);
        setSyncError(null);
      }, 5000);
    }
  };
  
  // Filters
  const [filterMonth, setFilterMonth] = useState<string>(getCurrentArabicMonthName());
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('unpaid');

  // Record Payment search and filter states
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addFilterGrade, setAddFilterGrade] = useState<string>('all');
  const [addFilterGroupId, setAddFilterGroupId] = useState<string>('all');
  const [allGroups, setAllGroups] = useState<any[]>([]);

  // Load groups on mount and when payments update
  useEffect(() => {
    try {
      setAllGroups(dbEngine.getGroups());
    } catch (e) {
      console.error("Failed to load groups in FinanceManager", e);
    }
  }, [payments]);

  // Editing state for Receipt view
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);

  // Prices State for settings
  const [tempPrices, setTempPrices] = useState<Record<GradeType, number>>({ ...prices });
  const [isPriceSaved, setIsPriceSaved] = useState(false);

  // Sync tempPrices when prop prices changes
  useEffect(() => {
    setTempPrices({ ...prices });
  }, [prices]);

  // Billing Start Month & Grade Month Discounts State
  const [billingStartMonth, setBillingStartMonth] = useState<string>(dbEngine.getBillingStartMonth());
  const [gradeMonthDiscounts, setGradeMonthDiscounts] = useState<Array<{ id: string; grade: GradeType; month: string; discount: number }>>(dbEngine.getGradeMonthDiscounts());

  // States for blank payment sheet printing
  const [blankSheetGrade, setBlankSheetGrade] = useState<GradeType>('الصف الأول الإعدادي');
  const [blankSheetMonth, setBlankSheetMonth] = useState<string>('أكتوبر');

  // QR Scanning States & Refs for recording payments
  const [isFinanceCameraActive, setIsFinanceCameraActive] = useState(false);
  const [financeScanSuccessMessage, setFinanceScanSuccessMessage] = useState<string | null>(null);
  const [financeScanErrorMessage, setFinanceScanErrorMessage] = useState<string | null>(null);

  const financeScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const financeLastScannedRef = useRef<{ id: string; time: number } | null>(null);
  const financeScanTimeoutRef = useRef<any>(null);

  const processFinanceStudentQrScan = (studentId: string) => {
    const student = students.find(s => s.id === studentId || s.code === studentId);
    if (!student) {
      setFinanceScanErrorMessage('عذراً، كود الطالب الممسوح غير مطابق لأي سجل أو قد يكون تالفاً!');
      if (financeScanTimeoutRef.current) clearTimeout(financeScanTimeoutRef.current);
      financeScanTimeoutRef.current = setTimeout(() => {
        setFinanceScanErrorMessage(null);
      }, 2500);
      return;
    }

    const due = dbEngine.calculateStudentDue(student, paymentForm.month);
    
    setPaymentForm(prev => ({
      ...prev,
      studentId: student.id,
      amountPaid: due
    }));

    setFinanceScanSuccessMessage(`تم التعرف على الطالب وتحديده بنجاح: ${student.name}`);
    setIsFinanceCameraActive(false);
    
    // Stop the scanner immediately if active
    if (financeScannerRef.current) {
      financeScannerRef.current.clear().catch(err => console.error(err));
      financeScannerRef.current = null;
    }

    if (financeScanTimeoutRef.current) clearTimeout(financeScanTimeoutRef.current);
    financeScanTimeoutRef.current = setTimeout(() => {
      setFinanceScanSuccessMessage(null);
    }, 3000);
  };

  const startFinanceCameraScanner = () => {
    setIsFinanceCameraActive(true);
    setFinanceScanErrorMessage(null);
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "finance-qr-reader-container",
          { 
            fps: 10, 
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true
          },
          /* verbose= */ false
        );
        financeScannerRef.current = scanner;
        
        scanner.render(
          (decodedText) => {
            const now = Date.now();
            if (financeLastScannedRef.current && financeLastScannedRef.current.id === decodedText && now - financeLastScannedRef.current.time < 3000) {
              return; // Ignore rapid consecutive duplicate scans
            }
            financeLastScannedRef.current = { id: decodedText, time: now };
            processFinanceStudentQrScan(decodedText);
          },
          (error) => {
            // failure is common when sweeps across blank area
          }
        );
      } catch (err) {
        console.error("Finance camera startup fail", err);
        setIsFinanceCameraActive(false);
      }
    }, 100);
  };

  const stopFinanceCameraScanner = () => {
    if (financeScannerRef.current) {
      financeScannerRef.current.clear().catch(err => console.error("Scanner clear fail", err));
      financeScannerRef.current = null;
    }
    setIsFinanceCameraActive(false);
  };

  // Cleanup finance camera scanner on unmount
  useEffect(() => {
    return () => {
      if (financeScannerRef.current) {
        financeScannerRef.current.clear().catch(err => console.log(err));
      }
      if (financeScanTimeoutRef.current) {
        clearTimeout(financeScanTimeoutRef.current);
      }
    };
  }, []);

  // Form states for adding a discount
  const [discountGrade, setDiscountGrade] = useState<GradeType>('الصف الثالث الإعدادي');
  const [discountMonth, setDiscountMonth] = useState<string>('أكتوبر');
  const [discountAmountInput, setDiscountAmountInput] = useState<number>(0);

  const handleAddGradeDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    if (discountAmountInput <= 0) return;
    
    const newDiscount = {
      id: `gd_${Date.now()}`,
      grade: discountGrade,
      month: discountMonth,
      discount: Number(discountAmountInput)
    };
    
    const updated = [...gradeMonthDiscounts, newDiscount];
    dbEngine.setGradeMonthDiscounts(updated);
    setGradeMonthDiscounts(updated);
    setDiscountAmountInput(0);
    onRefresh();
  };

  const handleDeleteGradeDiscount = (id: string) => {
    const updated = gradeMonthDiscounts.filter(d => d.id !== id);
    dbEngine.setGradeMonthDiscounts(updated);
    setGradeMonthDiscounts(updated);
    onRefresh();
  };

  const handleAddSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const codeOrName = addSearchQuery.trim();
      if (!codeOrName) return;

      const found = students.find(s => 
        s.status === 'approved' && 
        (s.code.toLowerCase() === codeOrName.toLowerCase() || s.name === codeOrName)
      );

      if (found) {
        const due = dbEngine.calculateStudentDue(found, paymentForm.month);
        setPaymentForm({ ...paymentForm, studentId: found.id, amountPaid: due });
        setFinanceScanSuccessMessage(`تم العثور على الطالب بنجاح باستخدام كود QR: ${found.name}`);
        setTimeout(() => setFinanceScanSuccessMessage(null), 3000);
      } else {
        // Try loose match
        const looseFound = students.filter(s => 
          s.status === 'approved' && 
          (s.code.toLowerCase().includes(codeOrName.toLowerCase()) || s.name.includes(codeOrName))
        );
        if (looseFound.length === 1) {
          const matched = looseFound[0];
          const due = dbEngine.calculateStudentDue(matched, paymentForm.month);
          setPaymentForm({ ...paymentForm, studentId: matched.id, amountPaid: due });
          setFinanceScanSuccessMessage(`تم التعرف تلقائياً على: ${matched.name}`);
          setTimeout(() => setFinanceScanSuccessMessage(null), 3000);
        }
      }
    }
  };

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    month: getCurrentArabicMonthName(),
    amountPaid: 0,
    paymentMethod: 'نقدي',
    notes: ''
  });

  // Available Months representation (من شهر أغسطس حتى يوليو)
  const MONTHS = [
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو'
  ];

  // Sorted students for the manual blank sheet
  const blankSheetStudentsSorted = useMemo(() => {
    return students
      .filter(s => s.grade === blankSheetGrade && s.status === 'approved')
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [students, blankSheetGrade]);

  const handlePrintBlankSheet = () => {
    const element = document.getElementById('blank-sheet-print-area');
    if (!element) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) {
      window.print();
      return;
    }

    let stylesHtml = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
      stylesHtml += el.outerHTML;
    });

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة كشف سداد الرسوم اليدوي</title>
          ${stylesHtml}
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap');
            body {
              background-color: white !important;
              color: #0f172a !important;
              padding: 30px !important;
              font-family: 'Cairo', sans-serif !important;
              direction: rtl !important;
              text-align: right !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 20px !important;
              font-size: 11px !important;
            }
            th, td {
              border: 1px solid #1e293b !important;
              padding: 8px 10px !important;
              text-align: right !important;
              vertical-align: middle !important;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 800 !important;
              color: #0f172a !important;
            }
            td {
              color: #0f172a !important;
              font-weight: 500 !important;
            }
            .blank-box {
              height: 24px;
              width: 100%;
            }
          </style>
        </head>
        <body class="bg-white">
          <div style="direction: rtl;">
            ${element.innerHTML}
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 100);
              }, 150);
            });
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    dbEngine.setPrices(tempPrices);
    dbEngine.setBillingStartMonth(billingStartMonth);
    setIsPriceSaved(true);
    setTimeout(() => {
      setIsPriceSaved(false);
    }, 2000);
    onRefresh();
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.studentId) return;

    const student = students.find(s => s.id === paymentForm.studentId);
    if (!student) return;

    // Calculate amountDue based on student's grade price, start month & grade month discounts
    const amountDue = dbEngine.calculateStudentDue(student, paymentForm.month);

    const recorded = dbEngine.addPayment({
      studentId: student.id,
      studentName: student.name,
      grade: student.grade,
      month: paymentForm.month,
      amountPaid: Number(paymentForm.amountPaid),
      amountDue,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: paymentForm.paymentMethod,
      notes: paymentForm.notes
    });

    onRefresh();
    setSelectedReceiptPayment(recorded); // Show receipt after immediate success!
    setPaymentForm({
      studentId: '',
      month: paymentForm.month,
      amountPaid: 0,
      paymentMethod: 'نقدي',
      notes: ''
    });
    setActiveSubTab('history');
  };

  const confirmDeletePayment = () => {
    if (!deletingPayment) return;
    dbEngine.deletePayment(deletingPayment.id);
    setDeletingPayment(null);
    onRefresh();
  };

  // Find unpaid students for a targeted month
  const getDebtors = () => {
    const activeStudents = students.filter(s => {
      if (s.status !== 'approved') return false;
      
      // Grade filter
      if (filterGrade !== 'all' && s.grade !== filterGrade) return false;
      
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = s.name.toLowerCase().includes(q);
        const codeMatch = s.code.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch) return false;
      }
      
      return true;
    });
    const monthPayments = payments.filter(p => p.month === filterMonth);

    return activeStudents.map(student => {
      const studentMonthPayments = monthPayments.filter(p => p.studentId === student.id);
      const totalPaid = studentMonthPayments.reduce((acc, p) => acc + p.amountPaid, 0);
      
      const amountDue = dbEngine.calculateStudentDue(student, filterMonth);

      const balance = amountDue - totalPaid;
      
      return {
        student,
        totalPaid,
        amountDue,
        balance,
        status: balance <= 0 ? 'paid' : 'debtor'
      };
    }).filter(record => {
      if (filterPaymentStatus === 'unpaid') {
        return record.status === 'debtor' && record.amountDue > 0;
      } else if (filterPaymentStatus === 'paid') {
        return record.status === 'paid';
      } else {
        return true; // 'all'
      }
    });
  };

  // Excel Outflows Reporting
  const handleExportPaymentsExcel = () => {
    if (activeSubTab === 'history') {
      const data = filteredPayments.map((p, idx) => ({
        'م': idx + 1,
        'رقم العملية': p.id,
        'اسم الطالب': p.studentName,
        'الصف الدراسي': p.grade,
        'الشهر المالي': p.month,
        'المبلغ المسدد': p.amountPaid,
        'القيمة المطلوبة': p.amountDue,
        'طريقة الدفع': p.paymentMethod,
        'تاريخ السداد': p.date,
        'ملاحظات': p.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'التقرير_المالي');
      XLSX.writeFile(workbook, `سجل_المدفوعات_${filterMonth.replace(' ', '_')}.xlsx`);
    } else {
      const data = debtorsList.map((record, idx) => ({
        'م': idx + 1,
        'كود الطالب': record.student.code,
        'اسم الطالب': record.student.name,
        'الصف الدراسي': record.student.grade,
        'الشهر المالي': filterMonth,
        'المبلغ المسدد': record.totalPaid,
        'القيمة المطلوبة': record.amountDue,
        'المتبقي المستحق': record.balance,
        'الحالة': record.status === 'paid' ? 'مسدد بالكامل' : 'متأخرات/غير مسدد',
        'رقم اتصال الوالد': record.student.parentPhone || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'حالة_سداد_الطلاب');
      XLSX.writeFile(workbook, `تقرير_حالة_السداد_${filterMonth.replace(' ', '_')}.xlsx`);
    }
  };

  // Filter payments list
  const filteredPayments = payments.filter(p => {
    const matchesMonth = p.month === filterMonth;
    const matchesGrade = filterGrade === 'all' || p.grade === filterGrade;
    const matchesSearch = p.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMonth && matchesGrade && matchesSearch;
  });

  const debtorsList = getDebtors();

  // Computations
  const totalReceivedForMonth = payments
    .filter(p => p.month === filterMonth)
    .reduce((acc, p) => acc + p.amountPaid, 0);

  const totalDuesExpectedForMonth = students
    .filter(s => s.status === 'approved')
    .reduce((acc, s) => {
      return acc + dbEngine.calculateStudentDue(s, filterMonth);
    }, 0);

  const collectionPercentage = totalDuesExpectedForMonth > 0 
    ? Math.round((totalReceivedForMonth / totalDuesExpectedForMonth) * 100) 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200" id="finance-manager">
      
      {/* Financial Cloud Sync Explorer Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 text-right space-y-4 shadow-xs no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3.5">
          <div className="space-y-1">
            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Server className="w-4.5 h-4.5 text-indigo-600" />
              مراقبة ومطابقة المزامنة السحابية للدفاتر والاشتراكات
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
              يقوم النظام تلقائياً برصد وتأمين فواتير المقبوضات على خوادم السحابة. طابق السجلات لضمان سلامة الدفاتر المالية بين الأجهزة.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Live Connection Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold ${
              isOnline === true
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : isOnline === false
                ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {isOnline === true ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>متصل بالسحابة (مؤمن)</span>
                </>
              ) : isOnline === false ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>غير متصل بالسحابة</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                  <span>جاري فحص الاتصال...</span>
                </>
              )}
            </div>
            
            {/* Sync configuration check */}
            <span className="text-[10px] font-black px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
              {dbEngine.isFirebaseEnabled() ? 'المزامنة التلقائية: نشطة ⚡' : 'المزامنة التلقائية: معطلة 🔒'}
            </span>
          </div>
        </div>

        {/* Sync Feedbacks and Errors */}
        {syncFeedback && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-xl text-xs font-semibold animate-in fade-in duration-200">
            ✅ {syncFeedback}
          </div>
        )}
        {syncError && (
          <div className="p-3 bg-amber-50 text-amber-900 border border-amber-150 rounded-xl text-xs font-semibold animate-in fade-in duration-200">
            ⚠️ {syncError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Local records stat */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">إجمالي الإيصالات محلياً (المتصفح)</span>
              <strong className="text-lg text-slate-800 font-mono font-black">{payments.length} سند قبض</strong>
            </div>
            <div className="text-xl bg-white p-2 rounded-lg border border-slate-200">💻</div>
          </div>

          {/* Cloud records stat */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">المقبوضات المرفوعة سحابياً</span>
              <strong className="text-lg text-indigo-900 font-mono font-black">
                {cloudPaymentsCount !== null ? `${cloudPaymentsCount} سند قبض` : '—'}
              </strong>
            </div>
            <div className="text-xl bg-white p-2 rounded-lg border border-slate-200">☁️</div>
          </div>

          {/* Status Match check & action */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold">حالة تطابق الدفاتر:</span>
              {cloudPaymentsCount === null ? (
                <span className="text-slate-400">غير معلوم (أوفلاين)</span>
              ) : payments.length === cloudPaymentsCount ? (
                <span className="text-emerald-700 font-black flex items-center gap-1">
                  مطابقة تامة (100%) ✨
                </span>
              ) : (
                <span className="text-amber-700 font-black flex items-center gap-1 animate-pulse">
                  يوجد فروقات غير مرفوعة ⚠️
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              {pendingQueueCount > 0 && (
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-black px-2 py-0.5 rounded-full animate-pulse">
                  {pendingQueueCount} عملية معلقة
                </span>
              )}
              
              <button
                type="button"
                onClick={handleForceSyncFinance}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>مزامنة وتأمين الدفاتر الآن</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security / Role disclaimer */}
        <div className="text-[10px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-150 flex items-center gap-1.5 justify-end">
          <span>🔒 يرجى العلم: حركات المزامنة وحفظ النسخ مشروطة تفاعلياً وامتيازياً لتسجيل دخول الطاقم السري (الأدمن) فقط.</span>
        </div>
      </div>

      {/* Financial Upper overview metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print text-right">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-500 text-xs">إيرادات المحصلة لـ ({filterMonth})</p>
            <h4 className="text-xl font-bold font-sans text-slate-900">{totalReceivedForMonth} ج.م</h4>
            <p className="text-[10px] text-slate-400">إجمالي السداد النقدي وحوالات الكاش المقيدة</p>
          </div>
          <div className="bg-slate-50 text-slate-700 p-3 rounded-lg border border-slate-200">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <button
          onClick={() => {
            setFilterPaymentStatus('unpaid');
            setActiveSubTab('debtors');
          }}
          className={`p-5 rounded-xl border transition-all text-right flex items-center justify-between cursor-pointer ${
            activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white border-slate-200 hover:border-slate-400'
          }`}
        >
          <div className="space-y-1">
            <p className={`text-xs ${activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid' ? 'text-slate-300' : 'text-slate-500'}`}>المتخلفين عن السداد</p>
            <h4 className="text-xl font-bold font-sans">{debtorsList.filter(d => d.status === 'debtor' && d.amountDue > 0).length} طالب</h4>
            <p className={`text-[10px] ${activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid' ? 'text-slate-400' : 'text-red-650 font-bold'}`}>يتطلب تدخلاً ماليًا للمستحقات</p>
          </div>
          <div className={`p-3 rounded-lg ${activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-red-50 text-red-650 border border-red-100'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </button>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1 w-full text-right">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>نسبة تحصيل الدفعة للمركز</span>
              <span className="font-bold text-slate-900">{collectionPercentage}%</span>
            </div>
            {/* progress line */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  collectionPercentage >= 80 ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
                style={{ width: `${Math.min(collectionPercentage, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">المستهدف الشهري الإجمالي: {totalDuesExpectedForMonth} ج.م</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Month Quick Selection */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 no-print text-right">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex space-x-1.5 space-x-reverse flex-wrap gap-y-2">
            <button
              onClick={() => setActiveSubTab('debtors')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'debtors' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              حالة سداد الطلاب 📊
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'history' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              سجل المقبوضات
            </button>
            <button
              onClick={() => setActiveSubTab('add')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === 'add' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              قيد سداد جديد
            </button>
            <button
              onClick={() => setActiveSubTab('blankSheet')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === 'blankSheet' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة كشف فارغ (يدوي)
            </button>
            <button
              onClick={() => setActiveSubTab('prices')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === 'prices' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              الإعدادات والأسعار والخصومات
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">الشهر المالي المستهدف:</span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs font-bold outline-none text-right transition-all"
            >
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters shown ONLY on receipts history and debtors */}
        {(activeSubTab === 'history' || activeSubTab === 'debtors') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث باسم الطالب أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all"
              />
            </div>

            <div>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all"
              >
                <option value="all">كل المراحل والصفوف الدراسية</option>
                <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              {activeSubTab === 'debtors' ? (
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => setFilterPaymentStatus(e.target.value as 'all' | 'paid' | 'unpaid')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all font-bold text-slate-700"
                >
                  <option value="unpaid">حالة السداد: غير المسددين 🔴</option>
                  <option value="paid">حالة السداد: المسددين والمعفيين 🟢</option>
                  <option value="all">حالة السداد: كل الحالات ⚪</option>
                </select>
              ) : (
                <div className="px-3 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs text-center font-bold">
                  حالة السداد: مسدد 🟢
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleExportPaymentsExcel}
                className="w-full px-4 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                تصدير السجل إكسل
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Area */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden no-print">
        {/* SUBTAB 1: PAYMENTS HISTORY/LEDGER */}
        {activeSubTab === 'history' && (
          <div className="overflow-x-auto text-right">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-6">اسم الطالب الملتزم</th>
                  <th className="py-3 px-6">الصف الدراسي</th>
                  <th className="py-3 px-6">الشهر المقيد له</th>
                  <th className="py-3 px-6">المبلغ المسدد</th>
                  <th className="py-3 px-6">المطلوب أساساً</th>
                  <th className="py-3 px-6">قناة وتاريخ السداد</th>
                  <th className="py-3 px-6 text-left">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      لا توجد مدفوعات مقيدة لشهر {filterMonth} تتطابق مع التصفية.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-55/50 hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-800 text-sm">{p.studentName}</div>
                        <div className="text-[10px] text-slate-400 mt-1">كود المالية: {p.id}</div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-650">{p.grade}</td>
                      <td className="py-3.5 px-6 text-slate-900 font-bold">{p.month}</td>
                      <td className="py-3.5 px-6">
                        <span className="bg-emerald-50 text-emerald-800 font-bold text-xs px-2.5 py-1 rounded border border-emerald-100">
                          {p.amountPaid} ج.م
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-bold text-slate-500 font-mono">{p.amountDue} ج.م</td>
                      <td className="py-3.5 px-6 font-mono space-y-0.5 text-slate-600">
                        <div className="font-bold text-xs">{p.paymentMethod}</div>
                        <div className="text-[10px] text-slate-400">{p.date}</div>
                      </td>
                      <td className="py-3.5 px-6 text-left space-x-1.5 space-x-reverse">
                        <button
                          onClick={() => setSelectedReceiptPayment(p)}
                          className="p-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg inline-flex items-center transition cursor-pointer"
                          title="طباعة إيصال السند المالي"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingPayment(p)}
                          className="p-1.5 bg-red-50 text-red-655 hover:bg-red-100 border border-red-100 rounded-lg inline-flex items-center transition cursor-pointer"
                          title="حذف العملية من الدفاتر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 2: RECORD PAYMENT FORM */}
        {activeSubTab === 'add' && (
          <form onSubmit={handleRecordPayment} className="p-6 md:p-8 space-y-6 text-right">
            <div>
              <h3 className="font-bold text-slate-850 text-base">تسجيل وتحصيل معاملة اشتراك جديدة</h3>
              <p className="text-slate-500 text-xs mt-1">يجرى توجيه المدفوعات وتحديد الخصومات المعفاة لمستحقي الدعم تلقائيًا وفق الإعداد المسبق للمتعلم.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Smart Student Selector Panel */}
              <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-200/60 pb-3">
                  <div>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-lg border border-indigo-100">البحث الذكي والتصفية</span>
                    <h4 className="text-xs font-bold text-slate-800 mt-1.5">ابحث واقترن بالطالب المناسب لتسجيل اشتراكه</h4>
                  </div>
                  {paymentForm.studentId && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentForm({ ...paymentForm, studentId: '', amountPaid: 0 });
                        setAddSearchQuery('');
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-850 flex items-center gap-1 cursor-pointer transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      إلغاء اختيار الطالب الحالي
                    </button>
                  )}
                </div>

                {/* If already selected, show beautiful Info Card */}
                {paymentForm.studentId ? (
                  (() => {
                    const student = students.find(s => s.id === paymentForm.studentId);
                    if (!student) return null;
                    const group = allGroups.find(g => g.id === student.groupId);
                    const basePrice = prices[student.grade];
                    
                    // Check if already paid this month
                    const prevPaid = payments
                      .filter(p => p.studentId === student.id && p.month === paymentForm.month)
                      .reduce((sum, p) => sum + p.amountPaid, 0);

                    return (
                      <div className="bg-white border-2 border-emerald-500 rounded-xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-full border border-emerald-150">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-sm">{student.name}</span>
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black">كود: {student.code}</span>
                            </div>
                            <div className="text-xs text-slate-500 font-semibold">
                              <span>{student.grade}</span>
                              <span className="mx-1.5">•</span>
                              <span className="text-slate-700 font-bold">المجموعة: {group ? group.name : 'غير محددة'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                          {prevPaid > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-right space-y-0.5 shrink-0">
                              <span className="text-[10px] text-amber-800 font-extrabold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                تنبيه: مسدد مسبقًا لهذا الشهر
                              </span>
                              <span className="text-[11px] text-slate-600 font-bold block">قام بدفع: <strong className="font-mono text-amber-900">{prevPaid} ج.م</strong></span>
                            </div>
                          )}

                          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-1.5 text-right shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold block">حالة الإعفاء/الخصم</span>
                            <span className="text-xs font-black text-slate-700">
                              {student.exemptionType === 'full' && '🎁 معفى كلياً (0 ج.م)'}
                              {student.exemptionType === 'partial' && `📉 خصم جزئي (${student.discountAmount} ج.م)`}
                              {student.exemptionType === 'none' && '💵 لا يوجد خصم (كامل)'}
                            </span>
                          </div>

                          <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg px-3.5 py-1.5 text-right shrink-0">
                            <span className="text-[10px] text-emerald-800 font-bold block">القيمة الموصى بها</span>
                            <strong className="text-sm font-black text-emerald-900 font-mono">
                              {dbEngine.calculateStudentDue(student, paymentForm.month)} ج.م
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  // Search & Selection Area
                  <div className="space-y-4">
                    {/* Floating messages for Scan */}
                    {financeScanSuccessMessage && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{financeScanSuccessMessage}</span>
                      </div>
                    )}
                    {financeScanErrorMessage && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-2 animate-in fade-in duration-200">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>{financeScanErrorMessage}</span>
                      </div>
                    )}

                    {/* Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {/* Search box with QR Scanner button */}
                      <div className="md:col-span-2 flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="ابحث باسم الطالب أو كود الـ QR..."
                            value={addSearchQuery}
                            onChange={(e) => setAddSearchQuery(e.target.value)}
                            onKeyDown={handleAddSearchKeyDown}
                            className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs outline-none text-right transition-all font-sans font-medium"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={startFinanceCameraScanner}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shrink-0"
                          title="البحث السريع بمسح QR كود الطالب"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>مسح QR</span>
                        </button>
                      </div>

                      {/* Grade Filter */}
                      <div>
                        <select
                          value={addFilterGrade}
                          onChange={(e) => {
                            setAddFilterGrade(e.target.value);
                            setAddFilterGroupId('all'); // Reset group when grade changes
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs outline-none text-right transition-all font-sans font-bold"
                        >
                          <option value="all">كل الصفوف الدراسية</option>
                          <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                          <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                          <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                          <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                          <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                          <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                        </select>
                      </div>

                      {/* Group Filter */}
                      <div>
                        <select
                          value={addFilterGroupId}
                          onChange={(e) => setAddFilterGroupId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs outline-none text-right transition-all"
                        >
                          <option value="all">كل المجموعات الدراسية</option>
                          {allGroups
                            .filter(g => addFilterGrade === 'all' || g.grade === addFilterGrade)
                            .map(g => (
                              <option key={g.id} value={g.id}>{g.name} ({g.grade})</option>
                            ))
                          }
                        </select>
                      </div>
                    </div>

                    {/* Results Selection Grid */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {(() => {
                        const activeStudents = students.filter(s => s.status === 'approved');
                        const addFiltered = activeStudents.filter(s => {
                          const matchesSearch = addSearchQuery === '' || 
                            s.name.toLowerCase().includes(addSearchQuery.toLowerCase()) || 
                            s.code.toLowerCase().includes(addSearchQuery.toLowerCase());
                          const matchesGrade = addFilterGrade === 'all' || s.grade === addFilterGrade;
                          const matchesGroup = addFilterGroupId === 'all' || s.groupId === addFilterGroupId;
                          return matchesSearch && matchesGrade && matchesGroup;
                        });

                        if (addFiltered.length === 0) {
                          return (
                            <div className="text-center py-8 text-slate-400 italic text-xs">
                              {addSearchQuery || addFilterGrade !== 'all' || addFilterGroupId !== 'all'
                                ? 'لا توجد نتائج مطابقة لبحثك وتصفياتك الحالية.'
                                : 'يرجى البدء بالبحث أو التصفية واختيار المتعلم...'}
                            </div>
                          );
                        }

                        return addFiltered.map(s => {
                          const due = dbEngine.calculateStudentDue(s, paymentForm.month);

                          const group = allGroups.find(g => g.id === s.groupId);
                          
                          // Check month status
                          const prevPaid = payments
                            .filter(p => p.studentId === s.id && p.month === paymentForm.month)
                            .reduce((sum, p) => sum + p.amountPaid, 0);

                          return (
                            <div 
                              key={s.id} 
                              onClick={() => {
                                setPaymentForm({ ...paymentForm, studentId: s.id, amountPaid: due });
                              }}
                              className="p-3 hover:bg-indigo-50/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all cursor-pointer group/item"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 group-hover/item:text-indigo-900 transition">{s.name}</span>
                                  <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black">كود: {s.code}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-semibold">
                                  <span>{s.grade}</span>
                                  <span className="mx-1">•</span>
                                  <span>المجموعة: {group ? group.name : 'غير محددة'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                {prevPaid > 0 ? (
                                  <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold animate-pulse">
                                    مسدد جزئياً/كلياً ({prevPaid} ج.م)
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                                    لم يسدد بعد
                                  </span>
                                )}

                                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                                  {due} ج.م
                                </span>
                                <button
                                  type="button"
                                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded text-[11px] font-extrabold transition-colors cursor-pointer"
                                >
                                  اختيار الطالب
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* QR Simulation Bar for Finance */}
                    <div className="bg-indigo-50/50 border border-indigo-150 rounded-xl p-3.5 text-right space-y-2.5">
                      <div className="flex items-center gap-1.5 justify-start text-indigo-900">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <h5 className="font-bold text-[11px] font-sans">محاكاة مسح QR كود الطالب (لتجربة الـ QR بغير كاميرا فعلية)</h5>
                      </div>
                      <p className="text-[10px] text-indigo-700/80 leading-relaxed">
                        بما أنك بحاجة لتجربة الكود، انقر مباشرة على أي طالب لمحاكاة مسح كارت الـ QR الخاص به وتحديده لتسجيل اشتراكه فوراً:
                      </p>
                      <div className="flex flex-wrap gap-1.5 justify-start">
                        {students.filter(s => s.status === 'approved').slice(0, 6).map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => processFinanceStudentQrScan(s.id)}
                            className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-900 hover:bg-indigo-50 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <QrCode className="w-3 h-3 text-indigo-600" />
                            {s.name.split(' ')[0]} {s.name.split(' ')[1] || ''}
                          </button>
                        ))}
                        {students.filter(s => s.status === 'approved').length > 6 && (
                          <span className="text-[9px] text-slate-400 self-center">+ {students.filter(s => s.status === 'approved').length - 6} آخرين</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* QR CAMERA SCREEN OVERLAY CONTAINER */}
              {isFinanceCameraActive && (
                <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4 no-print">
                  <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4 text-center border border-slate-200">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h4 className="font-bold text-slate-900 text-sm">مسح كيو أر كود الطالب للحضور والمالية</h4>
                      <button type="button" onClick={stopFinanceCameraScanner} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-500">ضع رمز الـ QR Code الخاص بكارت الطالب أمام عدسة الكاميرا بوضوح تامة ليتم تحديده لتسجيل السداد.</p>
                    
                    {/* Real Reader target */}
                    <div id="finance-qr-reader-container" className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50"></div>

                    <button
                      type="button"
                      onClick={stopFinanceCameraScanner}
                      className="w-full py-2 bg-red-55 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs rounded-lg border border-red-100 transition cursor-pointer"
                    >
                      إلغاء تشغيل الكاميرا
                    </button>
                  </div>
                </div>
              )}

              {/* Month */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الدفتر لشهر المالي *</label>
                <select
                  required
                  value={paymentForm.month}
                  onChange={(e) => setPaymentForm({ ...paymentForm, month: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right font-bold transition-all"
                >
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Amount Paid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">المبلغ المقبوض الفعلي (ج.م) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={paymentForm.amountPaid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-405 rounded-lg text-xs text-right font-mono font-bold text-emerald-800 outline-none"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">طريقة التحصيل *</label>
                <select
                  required
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-55 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right"
                >
                  <option value="نقدي">نقدي (في السنتر)</option>
                  <option value="فودافون كاش">فودافون كاش (Vodafone Cash)</option>
                  <option value="فيزا">بطاقة فيزا / ماستر كارد</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">تفاصيل التحصيل وملاحظات السداد</label>
              <input
                type="text"
                placeholder="مثال: تم التحويل من رقم فودافون كاش لولي الأمر 010xxxxxxxx"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right outline-none transition-all"
              />
            </div>

            <div className="flex justify-start">
              <button
                type="submit"
                disabled={!paymentForm.studentId}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-850 transition cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                تحصيل دفعة وإصدار سند الإيصال
              </button>
            </div>
          </form>
        )}

        {/* SUBTAB 3: DEBTORS */}
        {activeSubTab === 'debtors' && (
          <div className="overflow-x-auto text-right">
            {filterPaymentStatus === 'unpaid' && (
              <div className="bg-amber-50/70 p-4 text-amber-900 text-xs font-bold border-b border-amber-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>هذه القائمة ترصد الطلاب المعتمدين النشطين الذين لم يقيدوا أي مدفوعات كاملة لـ <strong>شهر {filterMonth}</strong> حتى الآن.</span>
              </div>
            )}
            {filterPaymentStatus === 'paid' && (
              <div className="bg-emerald-50/70 p-4 text-emerald-900 text-xs font-bold border-b border-emerald-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span>هذه القائمة ترصد الطلاب المعتمدين النشطين الذين قاموا بسداد الاشتراكات بالكامل لـ <strong>شهر {filterMonth}</strong>.</span>
              </div>
            )}
            {filterPaymentStatus === 'all' && (
              <div className="bg-slate-50 p-4 text-slate-900 text-xs font-bold border-b border-slate-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-750 flex-shrink-0" />
                <span>هذه القائمة تعرض موقف الاشتراكات المالي العام لجميع الطلاب المعتمدين النشطين لـ <strong>شهر {filterMonth}</strong>.</span>
              </div>
            )}

            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-6">كود الطالب</th>
                  <th className="py-3 px-6">اسم الطالب بالكامل</th>
                  <th className="py-3 px-6">الصف الدراسي والمسار</th>
                  <th className="py-3 px-6 font-semibold">موقف السداد للشهر المالي</th>
                  <th className="py-3 px-6 font-semibold">رقم الاتصال (الوالد)</th>
                  <th className="py-3 px-6 text-left">الإجراء المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debtorsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      لا يوجد نتائج مطابقة للفلاتر المحددة حالياً.
                    </td>
                  </tr>
                ) : (
                  debtorsList.map(({ student, amountDue, balance }) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-slate-500 font-bold">{student.code}</td>
                      <td className="py-3.5 px-6 font-bold text-slate-900">{student.name}</td>
                      <td className="py-3.5 px-6 text-slate-650">{student.grade}</td>
                      <td className="py-3.5 px-6">
                        {balance <= 0 ? (
                          <span className="text-emerald-750 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded text-xs">
                            تم السداد بالكامل ✅ {amountDue === 0 && student.exemptionType === 'full' ? '(معفى كلياً)' : `(${amountDue} ج.م)`}
                          </span>
                        ) : (
                          <span className="text-red-750 font-bold bg-red-50 border border-red-100 px-2.5 py-1 rounded text-xs font-mono">
                            متبقي {balance} ج.م مطلوب (إجمالي: {amountDue}) 🔴
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-800">{student.parentPhone}</td>
                      <td className="py-3.5 px-6 text-left">
                        {balance <= 0 ? (
                          <span className="text-xs text-emerald-600 font-bold pl-4">مكتمل 🟢</span>
                        ) : (
                          <button
                            onClick={() => {
                              setPaymentForm({
                                studentId: student.id,
                                month: filterMonth,
                                amountPaid: balance,
                                paymentMethod: 'نقدي',
                                notes: 'تسويه دفع متأخرات لشهر ' + filterMonth
                              });
                              setActiveSubTab('add');
                            }}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-850 transition cursor-pointer"
                          >
                            تحصيل السداد الفوري
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 4: BASE PRICES & BILLING CONFIG SETTINGS */}
        {activeSubTab === 'prices' && (
          <div className="space-y-8 p-6 md:p-8 text-right">
            {/* Section 1: Base prices */}
            <form onSubmit={handlePriceUpdate} className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-bold text-slate-900 text-base">تغيير وضبط قيمة الاشتراك الشهري لمجموعات العلوم</h3>
                <p className="text-slate-500 text-xs mt-1">تحديد القيمة المالية الشهرية الأساسية المترتبة للاشتراك لكل صف دراسي على حدة.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(prices).map((grade) => (
                  <div key={grade}>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">{grade}</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        required
                        value={tempPrices[grade as GradeType] || ''}
                        onChange={(e) => setTempPrices({ ...tempPrices, [grade]: Number(e.target.value) })}
                        className="w-full px-3 py-2 pr-4 pl-16 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono font-bold outline-none"
                      />
                      <div className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-450 text-slate-403">جنيه مصري</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Section 2: Billing Start Month setting */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">تحديد شهر بدء محاسبة ومطالبة الطلاب بالرسوم</h3>
                  <p className="text-slate-500 text-xs mt-1">
                    الشهر الأكاديمي الذي تبدأ فيه مطالبة ومحاسبة جميع الطلاب بدفع اشتراكات المجموعات. الشهور السابقة لهذا الشهر لن تعتبر الطلاب مدينين فيها ولن تظهر في متأخرات السداد.
                  </p>
                </div>
                <div className="max-w-xs">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">شهر بدء الحساب</label>
                  <select
                    value={billingStartMonth}
                    onChange={(e) => setBillingStartMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all font-bold"
                  >
                    {MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isPriceSaved && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-bold rounded-lg text-center animate-in fade-in duration-200">
                  تم حفظ وتحديث لائحة الأثمان والإعدادات المعتمدة بنجاح!
                </div>
              )}

              <div className="flex justify-start">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-850 transition cursor-pointer"
                >
                  تحديث وحفظ أسعار الصفوف وإعدادات المحاسبة
                </button>
              </div>
            </form>

            {/* Section 3: Grade-Month discounts */}
            <div className="border-t border-slate-100 pt-8 space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-base">خصم محدد لجميع تلاميذ صف محدد خلال شهر محدد</h3>
                <p className="text-slate-500 text-xs mt-1">تطبيق خصم تعميمي تلقائي على جميع تلاميذ مرحلة دراسية كاملة خلال شهر مالي معين.</p>
              </div>

              <form onSubmit={handleAddGradeDiscount} className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الصف الدراسي المستهدف</label>
                  <select
                    value={discountGrade}
                    onChange={(e) => setDiscountGrade(e.target.value as GradeType)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all font-medium font-sans"
                  >
                    <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                    <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                    <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                    <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                    <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                    <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الشهر المالي</label>
                  <select
                    value={discountMonth}
                    onChange={(e) => setDiscountMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all font-medium font-sans"
                  >
                    {MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">قيمة الخصم التعميمي</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      required
                      value={discountAmountInput || ''}
                      onChange={(e) => setDiscountAmountInput(Number(e.target.value))}
                      className="w-full px-3 py-2 pr-4 pl-16 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono font-bold outline-none"
                      placeholder="مثال: 20"
                    />
                    <div className="absolute left-3 top-2 text-[10px] font-bold text-slate-400">جنيه</div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تطبيق وإضافة الخصم</span>
                </button>
              </form>

              {/* List of active discounts */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-700">الخصومات التعميمية النشطة حالياً:</h4>
                {gradeMonthDiscounts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-xl text-center border border-dashed border-slate-200">
                    لا توجد خصومات عامة مضافة لشهور محددة حالياً. يمكنك إضافة خصم باستخدام النموذج أعلاه.
                  </p>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl bg-white">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-4 font-bold">الصف الدراسي</th>
                          <th className="py-2.5 px-4 font-bold">الشهر</th>
                          <th className="py-2.5 px-4 font-bold">قيمة الخصم</th>
                          <th className="py-2.5 px-4 text-left">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gradeMonthDiscounts.map((discount) => (
                          <tr key={discount.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-2.5 px-4 font-bold text-slate-800 font-sans">{discount.grade}</td>
                            <td className="py-2.5 px-4 text-slate-600 font-medium font-sans">{discount.month}</td>
                            <td className="py-2.5 px-4 font-mono font-bold text-emerald-750 text-emerald-700">{discount.discount} ج.م</td>
                            <td className="py-2.5 px-4 text-left">
                              <button
                                type="button"
                                onClick={() => handleDeleteGradeDiscount(discount.id)}
                                className="p-1 text-red-600 hover:bg-red-50 hover:text-red-700 rounded transition cursor-pointer"
                                title="حذف الخصم"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 5: PRINT BLANK MANUAL SHEET */}
        {activeSubTab === 'blankSheet' && (
          <div className="p-6 md:p-8 space-y-8 text-right">
            <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">طباعة كشف سداد الرسوم اليدوي</h3>
                <p className="text-slate-500 text-xs mt-1">توليد وتنزيل/طباعة كشف فارغ بأسماء الطلاب لتسجيل وتدوين مستحقات ومقبوضات الاشتراك يدوياً أثناء الحصص.</p>
              </div>
              <button
                type="button"
                onClick={handlePrintBlankSheet}
                disabled={blankSheetStudentsSorted.length === 0}
                className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  blankSheetStudentsSorted.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>بدء طباعة الكشف الفارغ</span>
              </button>
            </div>

            {/* Print configuration form */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الصف الدراسي المطلوب</label>
                <select
                  value={blankSheetGrade}
                  onChange={(e) => setBlankSheetGrade(e.target.value as GradeType)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all font-bold font-sans text-slate-800"
                >
                  <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                  <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                  <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                  <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                  <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                  <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الشهر المالي المستهدف</label>
                <select
                  value={blankSheetMonth}
                  onChange={(e) => setBlankSheetMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all font-bold font-sans text-slate-800"
                >
                  {MONTHS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  معاينة الكشف قبل الطباعة (عدد الطلاب: {blankSheetStudentsSorted.length}):
                </h4>
                <span className="text-[10px] text-slate-400 font-bold">ورق مقاس A4 - اتجاه طولي</span>
              </div>

              {blankSheetStudentsSorted.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                  لا يوجد طلاب مسجلين ونشطين في "{blankSheetGrade}" حالياً. يرجى اختيار صف دراسي آخر للمعاملة.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  {/* Outer wrapper with ID for printer selector */}
                  <div id="blank-sheet-print-area" className="p-6 md:p-8 bg-white text-right font-sans">
                    {/* Sheet Header */}
                    <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
                      <h2 className="text-lg font-black text-slate-900">كشف تسجيل الرسوم والاشتراكات الشهرية (يدوي)</h2>
                      <p className="text-xs text-slate-600 font-bold mt-1">مجموعات العلوم المتطورة — الأستاذ محمود أبوذكري</p>
                      
                      <div className="flex justify-center gap-6 text-xs text-slate-800 font-bold mt-3 bg-slate-50 border border-slate-200 rounded-lg py-2 px-4 max-w-md mx-auto">
                        <div>
                          <span>الصف الدراسي: </span>
                          <span className="text-indigo-900">{blankSheetGrade}</span>
                        </div>
                        <div className="border-l border-slate-300"></div>
                        <div>
                          <span>شهر مستحقات: </span>
                          <span className="text-indigo-900">{blankSheetMonth}</span>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs border border-slate-900">
                        <thead>
                          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900">
                            <th className="py-2 px-2 border border-slate-900 text-center font-black w-10">م</th>
                            <th className="py-2 px-3 border border-slate-900 font-black w-48">اسم التلميذ</th>
                            <th className="py-2 px-2 border border-slate-900 text-center font-black w-20">كود التلميذ</th>
                            <th className="py-2 px-2 border border-slate-900 text-center font-black w-24">المستحق للدفع</th>
                            <th className="py-2 px-3 border border-slate-900 text-center font-black w-28">المبلغ المدفوع (ج.م)</th>
                            <th className="py-2 px-3 border border-slate-900 text-center font-black w-28">طريقة الدفع (كاش/نقدي)</th>
                            <th className="py-2 px-3 border border-slate-900 text-center font-black w-24">تاريخ السداد</th>
                            <th className="py-2 px-3 border border-slate-900 font-black">ملاحظات / توقيع المستلم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 animate-none">
                          {blankSheetStudentsSorted.map((student, idx) => {
                            const due = dbEngine.calculateStudentDue(student, blankSheetMonth);
                            let dueLabel = `${due} ج.م`;
                            if (due === 0) {
                              if (student.exemptionType === 'full') {
                                dueLabel = 'إعفاء كامل';
                              } else {
                                dueLabel = 'غير مطالب';
                              }
                            }
                            return (
                              <tr key={student.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-2 border border-slate-900 text-center font-bold font-mono text-slate-700">{idx + 1}</td>
                                <td className="py-2 px-3 border border-slate-900 font-bold text-slate-900 font-sans">{student.name}</td>
                                <td className="py-2 px-2 border border-slate-900 text-center font-mono font-bold text-slate-500">{student.id}</td>
                                <td className="py-2 px-2 border border-slate-900 text-center font-bold text-indigo-900 font-sans bg-slate-50/40">{dueLabel}</td>
                                {/* Blank cells for manual entries */}
                                <td className="py-2 px-3 border border-slate-900 bg-slate-50/10"></td>
                                <td className="py-2 px-3 border border-slate-900 bg-slate-50/10"></td>
                                <td className="py-2 px-3 border border-slate-900 bg-slate-50/10"></td>
                                <td className="py-2 px-3 border border-slate-900 bg-slate-50/10"></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer for manual records */}
                    <div className="mt-8 flex justify-between items-center text-[10px] text-slate-400 font-bold italic pt-4 border-t border-dashed border-slate-200">
                      <span>تاريخ استخراج الكشف: {new Date().toLocaleDateString('ar-EG')}</span>
                      <span>سجل المقبوضات والمتابعة المالي الورقي للمجموعات</span>
                      <span>امضاء المشرف / المستلم: ........................</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PRINT RECEIPT DISPLAY MODAL */}
      {selectedReceiptPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-100 no-print border border-slate-200">
            <button
              onClick={() => setSelectedReceiptPayment(null)}
              className="absolute left-4 top-4 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pt-2 text-center">
              <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-sm font-bold">سند تحصيل مغلق ومؤكد</span>
              <h3 className="text-base font-bold text-slate-900 mt-2 font-sans">إيصال الاستلام المالي</h3>
            </div>

            {/* printable receipt frame */}
            <div 
              id="payment-receipt"
              className="bg-slate-50 print-card p-6 rounded-xl border border-slate-200 text-right space-y-4 max-w-[325px] mx-auto text-xs font-sans"
            >
              <div className="text-center border-b border-slate-200 pb-2.5">
                <h4 className="font-bold text-slate-900 text-sm">مجموعات العلوم - الأستاذ محمود أبوذكري</h4>
                <p className="text-[9px] text-slate-400 font-bold mt-1">سجل المتابعة والتفوق الأكاديمي الرقمي</p>
              </div>

              <div className="space-y-2 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم السند المالي:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedReceiptPayment.id}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ المعاملة:</span>
                  <span className="font-mono text-slate-800 font-bold">{selectedReceiptPayment.date}</span>
                </div>

                <div className="border-t border-dashed border-slate-300 my-2"></div>

                <div>
                  <span className="text-slate-500">اسم الطالب:</span>
                  <p className="font-bold text-slate-950 text-xs mt-0.5">{selectedReceiptPayment.studentName}</p>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">العام / الصف الدراسي:</span>
                  <span className="font-bold text-slate-900">{selectedReceiptPayment.grade}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">عن رسوم شهر:</span>
                  <span className="font-bold text-slate-900">{selectedReceiptPayment.month}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">طريقة السداد:</span>
                  <span className="font-bold text-slate-900">{selectedReceiptPayment.paymentMethod}</span>
                </div>

                {selectedReceiptPayment.notes && (
                  <div className="bg-white p-2 border border-slate-200 rounded text-[10px] text-slate-500 italic">
                    ملاحظات: {selectedReceiptPayment.notes}
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 my-2"></div>

                <div className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-lg shadow-xs">
                  <span className="font-bold text-slate-650">المبلغ المقبوض:</span>
                  <span className="text-sm font-bold text-emerald-800 font-sans">{selectedReceiptPayment.amountPaid} ج.م</span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-slate-200 text-[10px] text-slate-400 font-semibold italic">
                * نشكركم على ثقتكم الغالية، تمنياتنا دائماً بدوام المجد والتفوق *
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setTimeout(() => {
                    const printContents = document.getElementById('payment-receipt')?.outerHTML;
                    if (printContents) {
                      document.body.innerHTML = `
                        <div class="print-only flex items-center justify-center min-h-screen bg-white" style="direction: rtl !important;">
                          ${printContents}
                        </div>
                      `;
                      window.print();
                      window.location.reload();
                    }
                  }, 100);
                }}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                طباعة الوصل الفوري
              </button>
              <button
                onClick={() => setSelectedReceiptPayment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PAYMENT CONFIRMATION MODAL */}
      {deletingPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 text-red-600">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                تأكيد إلغاء العملية المالية
              </h3>
            </div>

            {/* Modal Content */}
            <div className="text-xs text-slate-600 leading-relaxed font-semibold space-y-2">
              <p className="text-slate-800 text-sm font-bold">
                هل أنت متأكد تماماً من رغبتك في حذف أو إلغاء المعاملة المالية رقم <span className="text-red-655 font-mono">({deletingPayment.id})</span> نهائياً؟
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                سيؤدي هذا الإجراء إلى حذف قيد سداد الطالب <span className="text-slate-800 font-bold">"{deletingPayment.studentName}"</span> لشهر <span className="text-slate-800 font-bold">"{deletingPayment.month}"</span> بقيمة <span className="text-emerald-800 font-bold">{deletingPayment.amountPaid} ج.م</span> بالكامل من الدفاتر المالية. لا يمكن التراجع عن الحذف بعد التأكيد.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={confirmDeletePayment}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-xs cursor-pointer text-center"
              >
                نعم، احذف العملية المالية
              </button>
              <button
                type="button"
                onClick={() => setDeletingPayment(null)}
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
