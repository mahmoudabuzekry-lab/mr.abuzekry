/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { dbEngine } from '../db';
import { Student, Payment, GradeType, ExemptionType, doesMonthPrecedeDate } from '../types';
import { 
  DollarSign, Landmark, Filter, Search, Plus, Trash2, Printer, X, Download, 
  Settings, Check, TrendingUp, AlertTriangle, User, Calendar, Receipt, FileText, AlertCircle, ShieldAlert, CheckCircle,
  Cloud, CloudOff, RefreshCw, Wifi, WifiOff, Server, Database
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { testConnection, getPendingQueue, fetchEntityFromFirebase } from '../firebase';

interface FinanceManagerProps {
  students: Student[];
  payments: Payment[];
  prices: Record<GradeType, number>;
  onRefresh: () => void;
}

export default function FinanceManager({ students, payments, prices, onRefresh }: FinanceManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'add' | 'debtors' | 'prices'>('history');
  
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
  const [filterMonth, setFilterMonth] = useState<string>('يونيو 2026');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state for Receipt view
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);

  // Prices State for settings
  const [tempPrices, setTempPrices] = useState<Record<GradeType, number>>({ ...prices });
  const [isPriceSaved, setIsPriceSaved] = useState(false);

  // Record Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    month: 'يونيو 2026',
    amountPaid: 0,
    paymentMethod: 'نقدي',
    notes: ''
  });

  // Available Months representation
  const MONTHS = ['مايو 2026', 'يونيو 2026', 'يوليو 2026', 'أغسطس 2026', 'سبتمبر 2026'];

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    dbEngine.setPrices(tempPrices);
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

    // Calculate amountDue based on student's grade price & discounts
    const basePrice = prices[student.grade];
    let amountDue = basePrice;
    
    if (student.exemptionType === 'full') {
      amountDue = 0;
    } else if (student.exemptionType === 'partial') {
      amountDue = Math.max(0, basePrice - student.discountAmount);
    }

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
      // Do not charge or demand from any student for a month preceding their registration date on the platform
      if (doesMonthPrecedeDate(filterMonth, s.createdAt)) return false;
      return true;
    });
    const monthPayments = payments.filter(p => p.month === filterMonth);

    return activeStudents.map(student => {
      const studentMonthPayments = monthPayments.filter(p => p.studentId === student.id);
      const totalPaid = studentMonthPayments.reduce((acc, p) => acc + p.amountPaid, 0);
      
      const basePrice = prices[student.grade];
      let amountDue = basePrice;
      if (student.exemptionType === 'full') amountDue = 0;
      else if (student.exemptionType === 'partial') amountDue = Math.max(0, basePrice - student.discountAmount);

      const balance = amountDue - totalPaid;
      
      return {
        student,
        totalPaid,
        amountDue,
        balance,
        status: balance <= 0 ? 'paid' : 'debtor'
      };
    }).filter(record => record.status === 'debtor' && record.amountDue > 0); // Exemptions are not debtors
  };

  // Excel Outflows Reporting
  const handleExportPaymentsExcel = () => {
    const data = payments.map((p, idx) => ({
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
      let fee = prices[s.grade];
      if (s.exemptionType === 'full') return acc;
      if (s.exemptionType === 'partial') fee = Math.max(0, fee - s.discountAmount);
      return acc + fee;
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
          onClick={() => setActiveSubTab('debtors')}
          className={`p-5 rounded-xl border transition-all text-right flex items-center justify-between cursor-pointer ${
            activeSubTab === 'debtors'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white border-slate-200 hover:border-slate-400'
          }`}
        >
          <div className="space-y-1">
            <p className={`text-xs ${activeSubTab === 'debtors' ? 'text-slate-300' : 'text-slate-500'}`}>المتخلفين عن السداد</p>
            <h4 className="text-xl font-bold font-sans">{debtorsList.length} طالب</h4>
            <p className={`text-[10px] ${activeSubTab === 'debtors' ? 'text-slate-400' : 'text-red-650 font-bold'}`}>يتطلب تدخلاً ماليًا للمستحقات</p>
          </div>
          <div className={`p-3 rounded-lg ${activeSubTab === 'debtors' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-red-50 text-red-650 border border-red-100'}`}>
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
                  collectionPercentage >= 80 ? 'bg-emerald-600' : 'bg-slate-905 bg-slate-800'
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
          <div className="flex space-x-1.5 space-x-reverse">
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'history' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-205 hover:bg-slate-100'
              }`}
            >
              سجل المقبوضات
            </button>
            <button
              onClick={() => setActiveSubTab('add')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === 'add' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-205 hover:bg-slate-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              قيد سداد جديد
            </button>
            <button
              onClick={() => setActiveSubTab('prices')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeSubTab === 'prices' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-205 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              تعديل أسعار الصفوف
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث باسم الطالب المقيد..."
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

            <div className="flex justify-end">
              <button
                onClick={handleExportPaymentsExcel}
                className="px-4 py-2 bg-emerald-50 text-emerald-850 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
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
              {/* Select Student */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر الطالب السادد *</label>
                <select
                  required
                  value={paymentForm.studentId}
                  onChange={(e) => {
                    const student = students.find(s => s.id === e.target.value);
                    if (student) {
                      const basePrice = prices[student.grade];
                      let due = basePrice;
                      if (student.exemptionType === 'full') due = 0;
                      else if (student.exemptionType === 'partial') due = Math.max(0, basePrice - student.discountAmount);

                      setPaymentForm({ ...paymentForm, studentId: student.id, amountPaid: due });
                    } else {
                      setPaymentForm({ ...paymentForm, studentId: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-55 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all"
                >
                  <option value="">اختر من الطلاب النشطين بالمركز...</option>
                  {students
                    .filter(s => s.status === 'approved')
                    .map(s => {
                      const basePrice = prices[s.grade];
                      let extra = `(المستحق الشهري: ${basePrice} ج.م)`;
                      if (s.exemptionType === 'full') extra = '(معفى كليًا)';
                      else if (s.exemptionType === 'partial') extra = `(خصم مسبق: ${Math.max(0, basePrice - s.discountAmount)} ج.م)`;

                      return (
                        <option key={s.id} value={s.id}>{s.name} - {s.grade} {extra}</option>
                      );
                    })
                  }
                </select>
              </div>

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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right"
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
                className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-850 transition cursor-pointer"
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
            <div className="bg-amber-50/70 p-4 text-amber-900 text-xs font-bold border-b border-amber-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>هذه القائمة ترصد الطلاب المعتمدين النشطين الذين لم يقيدوا أي مدفوعات كاملة لـ <strong>شهر {filterMonth}</strong> حتى الآن.</span>
            </div>

            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-6">كود الطالب</th>
                  <th className="py-3 px-6">اسم الطالب بالكامل</th>
                  <th className="py-3 px-6">الصف الدراسي والمسار</th>
                  <th className="py-3 px-6 font-semibold">القيمة المستحقة المتبقية</th>
                  <th className="py-3 px-6 font-semibold">رقم الاتصال (الوالد)</th>
                  <th className="py-3 px-6 text-left">الإجراء المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debtorsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      تهانينا! الجميع قام بسداد هذا الشهر بالكامل أو لا يوجد متأخرات نشطة حالياً.
                    </td>
                  </tr>
                ) : (
                  debtorsList.map(({ student, amountDue, balance }) => (
                    <tr key={student.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-slate-500 font-bold">{student.code}</td>
                      <td className="py-3.5 px-6 font-bold text-slate-900">{student.name}</td>
                      <td className="py-3.5 px-6 text-slate-650">{student.grade}</td>
                      <td className="py-3.5 px-6">
                        <span className="text-red-750 font-bold bg-red-50 border border-red-100 px-2.5 py-0.5 rounded text-xs font-mono">
                          {balance} ج.م مطلوب (إجمالي: {amountDue})
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-800">{student.parentPhone}</td>
                      <td className="py-3.5 px-6 text-left">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB 4: BASE PRICES SETTINGS */}
        {activeSubTab === 'prices' && (
          <form onSubmit={handlePriceUpdate} className="p-6 md:p-8 space-y-6 text-right">
            <div>
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
                      value={tempPrices[grade as GradeType]}
                      onChange={(e) => setTempPrices({ ...tempPrices, [grade]: Number(e.target.value) })}
                      className="w-full px-3 py-2 pr-4 pl-16 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs text-right font-mono font-bold outline-none"
                    />
                    <div className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-450 text-slate-403">جنيه مصري</div>
                  </div>
                </div>
              ))}
            </div>

            {isPriceSaved && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-bold rounded-lg text-center">
                تم حفظ وتحديث لائحة الأثمان والمقادير المعتمدة لجميع المجموعات بنجاح!
              </div>
            )}

            <div className="flex justify-start">
              <button
                type="submit"
                className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-850 transition cursor-pointer"
              >
                تحديث وحفظ أسعار الصفوف
              </button>
            </div>
          </form>
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
