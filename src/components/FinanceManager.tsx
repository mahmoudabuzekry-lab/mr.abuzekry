/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbEngine } from '../db';
import { Student, Payment, GradeType, ExemptionType, MonthlyExemption, doesMonthPrecedeDate, getCurrentArabicMonthName, normalizePhoneNumber, ReceiptSettings, DEFAULT_RECEIPT_SETTINGS, ALL_GRADES, formatReceiptWhatsAppMessage, DEFAULT_WHATSAPP_RECEIPT_TEMPLATE } from '../types';
import { 
  DollarSign, Landmark, Filter, Search, Plus, Trash2, Printer, X, Download, 
  Settings, Check, TrendingUp, AlertTriangle, User, Calendar, Receipt, FileText, AlertCircle, ShieldAlert, CheckCircle,
  Cloud, CloudOff, RefreshCw, Wifi, WifiOff, Server, Database,
  QrCode, Camera, HelpCircle, CheckCircle2, Volume2, Users, Tag, Gift, Sparkles, Edit3, Save, RotateCcw, Building2, Phone, MapPin, MessageSquare, Layers,
  Share2, Send, Copy, Image as ImageIcon, MessageCircle, ExternalLink, Loader2
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRCodeSVG } from 'qrcode.react';
import { toPng, toBlob } from 'html-to-image';
import * as XLSX from 'xlsx';
import { testConnection, getPendingQueue, fetchEntityFromFirebase } from '../firebase';
import SiblingDiscountsManager from './SiblingDiscountsManager';
import ReceiptCustomizer from './ReceiptCustomizer';
import { PrivacyCard, PrivacyAmount } from './PrivacyAmount';

interface FinanceManagerProps {
  students: Student[];
  payments: Payment[];
  prices: Record<GradeType, number>;
  onRefresh: () => void;
}

export default function FinanceManager({ students, payments, prices, onRefresh }: FinanceManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'add' | 'debtors' | 'siblings' | 'prices' | 'blankSheet' | 'receiptSettings'>('debtors');
  
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
        const isUserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        setSyncError(isUserOffline 
          ? "الجهاز غير متصل بالإنترنت حالياً. تم حفظ العمليات محلياً بأمان."
          : "الخادم السحابي مؤجل الاستجابة حالياً. تم حفظ كافة العمليات محلياً 100% بأمان.");
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

  // Date filter for receipts ledger (سجل المقبوضات)
  const [filterDateMode, setFilterDateMode] = useState<'all' | 'today' | 'custom'>('all');
  const [filterCustomDate, setFilterCustomDate] = useState<string>('');
  const [filterDateAllMonths, setFilterDateAllMonths] = useState<boolean>(true);

  // Today's local date string formatted as YYYY-MM-DD
  const todayDateStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Today's payments statistics
  const todayPayments = useMemo(() => {
    return payments.filter(p => (p.date || '').split('T')[0] === todayDateStr);
  }, [payments, todayDateStr]);

  const todayPaymentsCount = todayPayments.length;
  const todayPaymentsTotal = useMemo(() => {
    return todayPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
  }, [todayPayments]);

  // Count of sibling families
  const siblingFamiliesCount = useMemo(() => {
    const approvedStudents = students.filter(s => s.status === 'approved');
    const phoneGroups: Record<string, number> = {};
    approvedStudents.forEach(st => {
      const cleanPhone = normalizePhoneNumber(st.parentPhone || st.phone);
      if (cleanPhone && cleanPhone.length >= 8) {
        phoneGroups[cleanPhone] = (phoneGroups[cleanPhone] || 0) + 1;
      }
    });
    return Object.values(phoneGroups).filter(count => count > 1).length;
  }, [students]);

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

  // Receipt modal & editing states
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);
  const [editingReceiptPayment, setEditingReceiptPayment] = useState<Payment | null>(null);
  const [receiptModalTab, setReceiptModalTab] = useState<'preview' | 'edit' | 'customize'>('preview');
  const [editReceiptSuccess, setEditReceiptSuccess] = useState<boolean>(false);
  const [modalReceiptSettings, setModalReceiptSettings] = useState<ReceiptSettings>(() => dbEngine.getReceiptSettings());
  const [modalSettingsSaved, setModalSettingsSaved] = useState<boolean>(false);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);

  // WhatsApp & Image sharing states
  const [targetParentPhone, setTargetParentPhone] = useState<string>('');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [customReceiptMessageDraft, setCustomReceiptMessageDraft] = useState<string>('');
  const [isEditingMessageDraft, setIsEditingMessageDraft] = useState<boolean>(false);
  const [whatsAppToast, setWhatsAppToast] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [paymentSuccessFeedback, setPaymentSuccessFeedback] = useState<{ msg: string; payment: Payment } | null>(null);

  const triggerWhatsAppToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setWhatsAppToast({ msg, type });
    setTimeout(() => setWhatsAppToast(null), 4500);
  };

  const getParentPhoneForPayment = (payment: Payment): string => {
    const st = students.find(s => s.id === payment.studentId || s.name.trim() === payment.studentName.trim());
    return st?.parentPhone || st?.phone || '';
  };

  const formatPhoneForWhatsApp = (rawPhone: string): string => {
    let clean = normalizePhoneNumber(rawPhone);
    if (!clean) return '';
    clean = clean.replace(/\D/g, '');
    if (clean.startsWith('01')) {
      clean = `20${clean.slice(1)}`; // 201xxxxxxxxx
    } else if (clean.startsWith('1') && clean.length === 10) {
      clean = `20${clean}`;
    }
    return clean;
  };

  const generateReceiptWhatsAppText = (payment: Payment, settings: ReceiptSettings, templateOverride?: string): string => {
    const student = students.find(s => s.id === payment.studentId || s.name === payment.studentName);
    const studentCode = student?.code || '';
    const studentDue = student ? dbEngine.calculateStudentDue(student, payment.month) : payment.amountPaid;
    const paymentWithExtra = {
      ...payment,
      studentCode,
      amountDue: studentDue
    };
    return formatReceiptWhatsAppMessage(paymentWithExtra, settings, templateOverride);
  };

  const openReceiptModal = (payment: Payment, initialTab: 'preview' | 'edit' | 'customize' = 'preview') => {
    setSelectedReceiptPayment(payment);
    setEditingReceiptPayment({ ...payment });
    setReceiptModalTab(initialTab);
    setEditReceiptSuccess(false);
    setModalSettingsSaved(false);
    const settings = dbEngine.getReceiptSettings();
    setModalReceiptSettings(settings);
    const phone = getParentPhoneForPayment(payment);
    setTargetParentPhone(phone);
    setIsEditingPhone(false);
    setIsEditingMessageDraft(false);

    const student = students.find(s => s.id === payment.studentId || s.name === payment.studentName);
    const studentCode = student?.code || '';
    const studentDue = student ? dbEngine.calculateStudentDue(student, payment.month) : payment.amountPaid;
    const paymentWithExtra = {
      ...payment,
      studentCode,
      amountDue: studentDue
    };
    setCustomReceiptMessageDraft(formatReceiptWhatsAppMessage(paymentWithExtra, settings));
  };

  const handleSendWhatsAppTextDirect = (payment: Payment) => {
    const phoneToUse = getParentPhoneForPayment(payment);
    const cleanPhone = formatPhoneForWhatsApp(phoneToUse);
    const settings = dbEngine.getReceiptSettings();
    const text = generateReceiptWhatsAppText(payment, settings);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    triggerWhatsAppToast(
      cleanPhone 
        ? `تم فتح واتساب لإرسال رسالة سداد المصروفات لولي أمر (${payment.studentName}) - ${phoneToUse} 📲` 
        : `تم فتح واتساب لإرسال رسالة سداد المصروفات لـ (${payment.studentName}) 📲`
    );
  };

  const handleSendWhatsAppText = (payment: Payment) => {
    const phoneToUse = targetParentPhone || getParentPhoneForPayment(payment);
    const cleanPhone = formatPhoneForWhatsApp(phoneToUse);
    const text = customReceiptMessageDraft || generateReceiptWhatsAppText(payment, modalReceiptSettings);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    triggerWhatsAppToast(cleanPhone ? `تم فتح واتساب لإرسال رسالة السداد للرقم (${phoneToUse})!` : 'تم فتح واتساب لإرسال تفاصيل السداد!');
  };

  const handleCopyWhatsAppText = async (payment: Payment) => {
    const text = customReceiptMessageDraft || generateReceiptWhatsAppText(payment, modalReceiptSettings);
    try {
      await navigator.clipboard.writeText(text);
      triggerWhatsAppToast('تم نسخ نص رسالة الإيصال بالكامل إلى الحافظة بنجاح!');
    } catch (e) {
      console.error(e);
      triggerWhatsAppToast('تعذر النسخ التلقائي للحافظة', 'error');
    }
  };

  const handleSendDebtorWhatsAppReminder = (student: Student, month: string, balance: number, amountDue: number) => {
    const phone = student.parentPhone || student.phone;
    const cleanPhone = formatPhoneForWhatsApp(phone);
    const settings = dbEngine.getReceiptSettings();
    const teacher = settings.teacherName || 'الأستاذ محمود أبوذكري';
    const center = settings.centerName || 'مجموعات العلوم المتطورة';
    const contactPhone = settings.phone ? `\n📞 *للتواصل والاستفسار:* ${settings.phone}` : '';

    const text = `السلام عليكم ورحمة الله وبركاته 🌸
تحية طيبة لولي أمر الطالب/ـة: *${student.name}* المحترم/ـة،

نود تذكير سيادتكم بمصروفات الاشتراك الشهري لمجموعات العلوم (*${student.grade}*):
🔹 *عن شهر:* ${month}
🔹 *المبلغ المطلوب سداده:* ${balance} ج.م (إجمالي الرسوم: ${amountDue} ج.م)

شاكرين ومقدرين دائماً حسن تعاونكم وثقتكم الغالية، متمنين لأبنائنا دوام التفوق 🌟
👨‍🏫 *${teacher}* - *${center}*${contactPhone}`;

    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    triggerWhatsAppToast(cleanPhone ? `تم فتح واتساب لإرسال تذكير المصروفات لولي أمر (${student.name})!` : 'تم فتح واتساب لإرسال تذكير المصروفات!');
  };

  const captureReceiptBlob = async (): Promise<Blob | null> => {
    const element = document.getElementById('payment-receipt-print-area');
    if (!element) return null;
    return await toBlob(element, {
      quality: 0.98,
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
  };

  const handleDownloadReceiptImage = async (payment: Payment) => {
    try {
      setIsGeneratingImage(true);
      const element = document.getElementById('payment-receipt-print-area');
      if (!element) throw new Error('Receipt DOM element not found');
      const dataUrl = await toPng(element, {
        quality: 0.98,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `إيصال_سداد_${payment.studentName}_${payment.month}_${payment.id}.png`;
      link.href = dataUrl;
      link.click();
      triggerWhatsAppToast('تم حفظ وتحميل صورة الإيصال بدقة عالية (PNG) بنجاح!');
    } catch (err) {
      console.error('Failed to export image', err);
      triggerWhatsAppToast('تعذر توليد صورة الإيصال، يرجى المحاولة ثانية', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCopyReceiptImage = async (payment: Payment) => {
    try {
      setIsGeneratingImage(true);
      const blob = await captureReceiptBlob();
      if (!blob) throw new Error('Could not render image blob');
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      triggerWhatsAppToast('تم نسخ صورة الإيصال إلى الحافظة! يمكنك لصقها (Ctrl+V) مباشرة في محادثة واتساب.');
    } catch (err) {
      console.error('Failed to copy image to clipboard', err);
      triggerWhatsAppToast('تعذر النسخ المباشر للحافظة، يمكنك استخدام زر تحميل الصورة.', 'info');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShareOrSendWhatsAppImage = async (payment: Payment) => {
    try {
      setIsGeneratingImage(true);
      const phoneToUse = targetParentPhone || getParentPhoneForPayment(payment);
      const cleanPhone = formatPhoneForWhatsApp(phoneToUse);
      const text = customReceiptMessageDraft || generateReceiptWhatsAppText(payment, modalReceiptSettings);

      const blob = await captureReceiptBlob();
      if (!blob) throw new Error('Could not render image');

      const file = new File([blob], `إيصال_سداد_${payment.studentName}_${payment.month}.png`, { type: 'image/png' });

      // Check if Web Share API with files is supported (Mobile browsers / Android / iOS / Tablets)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `إيصال سداد مالي - ${payment.studentName}`,
          text: text,
          files: [file],
        });
        triggerWhatsAppToast('تمت مشاركة صورة الإيصال مع رسالة التفاصيل بنجاح!');
        return;
      }

      // If Web Share with files is not supported (Desktop Chrome/Firefox/Edge):
      // 1. Try copy image to clipboard
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
      } catch {
        // ignore clipboard error
      }

      // 2. Download the PNG image file
      const dataUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `إيصال_سداد_${payment.studentName}_${payment.month}.png`;
      link.href = dataUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(dataUrl), 5000);

      // 3. Open WhatsApp chat with text message
      const waUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` 
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');

      triggerWhatsAppToast('تم نسخ وتحميل صورة الإيصال وفتح محادثة واتساب — الصق الصورة (Ctrl+V) أو أرفق الملف المحفوظ في الشات!');
    } catch (err) {
      console.error('Error sharing receipt image:', err);
      // Fallback: send text only
      handleSendWhatsAppText(payment);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveEditedReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceiptPayment) return;
    dbEngine.updatePayment(editingReceiptPayment);
    setSelectedReceiptPayment({ ...editingReceiptPayment });
    setEditReceiptSuccess(true);
    onRefresh();
    setTimeout(() => {
      setEditReceiptSuccess(false);
      setReceiptModalTab('preview');
    }, 1200);
  };

  const handleSaveModalReceiptSettings = () => {
    dbEngine.setReceiptSettings(modalReceiptSettings);
    if (selectedReceiptPayment) {
      setCustomReceiptMessageDraft(generateReceiptWhatsAppText(selectedReceiptPayment, modalReceiptSettings));
    }
    setModalSettingsSaved(true);
    onRefresh();
    setTimeout(() => {
      setModalSettingsSaved(false);
    }, 1800);
  };

  const handlePrintCurrentReceipt = () => {
    const printElement = document.getElementById('payment-receipt-print-area');
    if (!printElement || !selectedReceiptPayment) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const isThermal = modalReceiptSettings.receiptSize === 'thermal';

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${modalReceiptSettings.receiptTitle || 'إيصال استلام مالي'} - ${selectedReceiptPayment.studentName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            * {
              font-family: 'Cairo', sans-serif !important;
              box-sizing: border-box;
            }
            @media print {
              body {
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: ${isThermal ? '80mm auto' : 'auto'};
                margin: ${isThermal ? '2mm' : '8mm'};
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body class="bg-white p-2 flex items-center justify-center min-h-screen">
          <div style="width: ${isThermal ? '78mm' : '360px'}; margin: 0 auto; direction: rtl;">
            ${printElement.innerHTML}
          </div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 100);
              }, 250);
            });
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  // Prices State for settings
  const [tempPrices, setTempPrices] = useState<Record<GradeType, number>>({ ...prices });
  const [isPriceSaved, setIsPriceSaved] = useState(false);

  // Sync tempPrices when prop prices changes
  useEffect(() => {
    setTempPrices({ ...prices });
  }, [prices]);

  // Billing Start Month, Billing End Month & Grade Month Discounts State
  const [billingStartMonth, setBillingStartMonth] = useState<string>(dbEngine.getBillingStartMonth());
  const [billingEndMonth, setBillingEndMonth] = useState<string>(dbEngine.getBillingEndMonth());
  const [gradeMonthDiscounts, setGradeMonthDiscounts] = useState<Array<{ id: string; grade: GradeType; month: string; discount: number }>>(dbEngine.getGradeMonthDiscounts());

  // States for blank payment sheet printing
  const [blankSheetGrade, setBlankSheetGrade] = useState<GradeType>('الصف الأول الإعدادي');
  const [blankSheetMonth, setBlankSheetMonth] = useState<string>('أكتوبر');

  // State for Monthly Partial Exemption Modal
  const [monthlyExemptionModal, setMonthlyExemptionModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    month: string;
    discountAmount: number;
    reason: string;
  }>({
    isOpen: false,
    student: null,
    month: 'أكتوبر',
    discountAmount: 0,
    reason: '',
  });

  // State for Student Picker Modal (when selecting a student for monthly exemption)
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const [studentPickerGrade, setStudentPickerGrade] = useState<string>('all');

  // QR Scanning States & Refs for recording payments
  const [isFinanceCameraActive, setIsFinanceCameraActive] = useState(false);
  const [financeScanSuccessMessage, setFinanceScanSuccessMessage] = useState<string | null>(null);
  const [financeScanErrorMessage, setFinanceScanErrorMessage] = useState<string | null>(null);

  const financeScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const financeLastScannedRef = useRef<{ id: string; time: number } | null>(null);
  const financeScanTimeoutRef = useRef<any>(null);

  const playFinanceQrSound = (success: boolean = true) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      if (success) {
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
      }
    } catch (e) {}
  };

  const processFinanceStudentQrScan = (studentId: string) => {
    const student = students.find(s => s.id === studentId || s.code === studentId);
    if (!student) {
      playFinanceQrSound(false);
      setFinanceScanErrorMessage('عذراً، كود الطالب الممسوح غير مطابق لأي سجل أو قد يكون تالفاً!');
      if (financeScanTimeoutRef.current) clearTimeout(financeScanTimeoutRef.current);
      financeScanTimeoutRef.current = setTimeout(() => {
        setFinanceScanErrorMessage(null);
      }, 2500);
      return;
    }

    playFinanceQrSound(true);

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

  const formatStudentRegistrationDate = (createdAt?: string): string => {
    if (!createdAt) return 'غير محدد';
    try {
      const d = new Date(createdAt);
      if (isNaN(d.getTime())) return createdAt;
      return d.toLocaleDateString('ar-EG');
    } catch {
      return createdAt;
    }
  };

  const handleOpenMonthlyExemption = (student: Student, targetMonth?: string) => {
    const month = targetMonth || filterMonth || getCurrentArabicMonthName();
    const existing = student.monthlyExemptions?.[month];
    const { basePrice } = dbEngine.getStudentBasePrice(student);
    const gradeDiscount = dbEngine.getGradeMonthDiscounts().find(d => d.grade === student.grade && d.month === month)?.discount || 0;
    const permanentDiscount = student.exemptionType === 'partial' ? (student.discountAmount || 0) : 0;
    const remainingBeforeMonthly = Math.max(0, basePrice - permanentDiscount - gradeDiscount);
    
    // Determine suggested default discount
    let initialDiscount = 25;
    if (existing && existing.type === 'partial') {
      initialDiscount = existing.discountAmount;
    } else if (existing && existing.type === 'full') {
      initialDiscount = remainingBeforeMonthly;
    } else {
      initialDiscount = Math.min(remainingBeforeMonthly, 25);
    }

    setMonthlyExemptionModal({
      isOpen: true,
      student,
      month,
      discountAmount: initialDiscount,
      reason: existing?.reason || '',
    });
  };

  const handleMonthlyExemptionMonthChange = (newMonth: string) => {
    if (!monthlyExemptionModal.student) return;
    const student = monthlyExemptionModal.student;
    const existing = student.monthlyExemptions?.[newMonth];
    const { basePrice } = dbEngine.getStudentBasePrice(student);
    const gradeDiscount = dbEngine.getGradeMonthDiscounts().find(d => d.grade === student.grade && d.month === newMonth)?.discount || 0;
    const permanentDiscount = student.exemptionType === 'partial' ? (student.discountAmount || 0) : 0;
    const remainingBeforeMonthly = Math.max(0, basePrice - permanentDiscount - gradeDiscount);

    setMonthlyExemptionModal(prev => ({
      ...prev,
      month: newMonth,
      discountAmount: existing && existing.type === 'partial' 
        ? existing.discountAmount 
        : (existing && existing.type === 'full' ? remainingBeforeMonthly : Math.min(remainingBeforeMonthly, prev.discountAmount || 25)),
      reason: existing?.reason !== undefined ? existing.reason : prev.reason,
    }));
  };

  const handleSaveMonthlyExemption = () => {
    if (!monthlyExemptionModal.student) return;
    const student = monthlyExemptionModal.student;
    const month = monthlyExemptionModal.month;
    const discount = Number(monthlyExemptionModal.discountAmount) || 0;

    if (discount <= 0) {
      alert('يرجى إدخال قيمة خصم صالحة للإعفاء الجزئي (أكبر من 0 ج.م).');
      return;
    }

    const currentExemptions = student.monthlyExemptions ? { ...student.monthlyExemptions } : {};
    currentExemptions[month] = {
      type: 'partial',
      discountAmount: discount,
      reason: monthlyExemptionModal.reason.trim() || undefined,
      updatedAt: new Date().toISOString()
    };

    const updatedStudent: Student = {
      ...student,
      monthlyExemptions: currentExemptions
    };

    dbEngine.updateStudent(updatedStudent);
    onRefresh();

    if (paymentForm.studentId === student.id && paymentForm.month === month) {
      const newDue = dbEngine.calculateStudentDue(updatedStudent, month);
      setPaymentForm(prev => ({ ...prev, amountPaid: newDue }));
    }

    setMonthlyExemptionModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleRemoveMonthlyExemption = (targetStudent?: Student, targetMonth?: string) => {
    const student = targetStudent || monthlyExemptionModal.student;
    const month = targetMonth || monthlyExemptionModal.month;
    if (!student) return;

    if (!student.monthlyExemptions || !student.monthlyExemptions[month]) {
      setMonthlyExemptionModal(prev => ({ ...prev, isOpen: false }));
      return;
    }

    const currentExemptions = { ...student.monthlyExemptions };
    delete currentExemptions[month];

    const updatedStudent: Student = {
      ...student,
      monthlyExemptions: Object.keys(currentExemptions).length > 0 ? currentExemptions : undefined
    };

    dbEngine.updateStudent(updatedStudent);
    onRefresh();

    if (paymentForm.studentId === student.id && paymentForm.month === month) {
      const newDue = dbEngine.calculateStudentDue(updatedStudent, month);
      setPaymentForm(prev => ({ ...prev, amountPaid: newDue }));
    }

    setMonthlyExemptionModal(prev => ({ ...prev, isOpen: false }));
  };

  const handlePriceUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    dbEngine.setPrices(tempPrices);
    dbEngine.setBillingStartMonth(billingStartMonth);
    dbEngine.setBillingEndMonth(billingEndMonth);
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
    // Do NOT auto-open receipt modal; user can open it on demand by clicking the receipt button
    setPaymentSuccessFeedback({
      msg: `تم تسجيل وحفظ عملية التحصيل بنجاح في الدفاتر للطالب (${student.name}) بمبلغ ${paymentForm.amountPaid} ج.م عن شهر (${paymentForm.month}) ✅`,
      payment: recorded
    });
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
      const filename = filterDateMode === 'today'
        ? `سجل_مقبوضات_اليوم_${todayDateStr}.xlsx`
        : filterDateMode === 'custom' && filterCustomDate
        ? `سجل_مقبوضات_تاريخ_${filterCustomDate}.xlsx`
        : `سجل_المدفوعات_${filterMonth.replace(' ', '_')}.xlsx`;
      XLSX.writeFile(workbook, filename);
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

  // Filter payments list with date filter support
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Date filter
      let matchesDate = true;
      const paymentDate = (p.date || '').split('T')[0];

      if (filterDateMode === 'today') {
        matchesDate = paymentDate === todayDateStr;
      } else if (filterDateMode === 'custom' && filterCustomDate) {
        matchesDate = paymentDate === filterCustomDate;
      }

      // Month filter: When filtering by specific date and filterDateAllMonths is true, match all months
      const matchesMonth = (filterDateMode !== 'all' && filterDateAllMonths) || filterMonth === 'all' || p.month === filterMonth;
      const matchesGrade = filterGrade === 'all' || p.grade === filterGrade;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || p.studentName.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q);

      return matchesDate && matchesMonth && matchesGrade && matchesSearch;
    });
  }, [payments, filterDateMode, filterCustomDate, todayDateStr, filterDateAllMonths, filterMonth, filterGrade, searchQuery]);

  const filteredTotalPaid = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0);
  }, [filteredPayments]);

  const debtorsList = getDebtors();

  // Computations
  const totalReceivedForMonth = payments
    .filter(p => filterMonth === 'all' ? true : p.month === filterMonth)
    .reduce((acc, p) => acc + p.amountPaid, 0);

  const totalDuesExpectedForMonth = students
    .filter(s => s.status === 'approved')
    .reduce((acc, s) => {
      return acc + dbEngine.calculateStudentDue(s, filterMonth === 'all' ? getCurrentArabicMonthName() : filterMonth);
    }, 0);

  const collectionPercentage = totalDuesExpectedForMonth > 0 
    ? Math.round((totalReceivedForMonth / totalDuesExpectedForMonth) * 100) 
    : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-200" id="finance-manager">
      
      {/* Financial Cloud Sync Explorer Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 md:p-4 text-right space-y-3 shadow-xs no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 border-b border-slate-100 pb-2.5">
          <div className="space-y-0.5">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" />
              مراقبة ومطابقة المزامنة السحابية للدفاتر والاشتراكات
            </h4>
            <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">
              يقوم النظام تلقائياً برصد وتأمين فواتير المقبوضات على خوادم السحابة. طابق السجلات لضمان سلامة الدفاتر المالية بين الأجهزة.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Live Connection Badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10.5px] font-bold ${
              isOnline === true
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : isOnline === false
                ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {isOnline === true ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span>متصل بالسحابة (مؤمن)</span>
                </>
              ) : isOnline === false ? (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>غير متصل بالسحابة</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-400" />
                  <span>جاري فحص الاتصال...</span>
                </>
              )}
            </div>
            
            {/* Sync configuration check */}
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
              {dbEngine.isFirebaseEnabled() ? 'المزامنة التلقائية: نشطة ⚡' : 'المزامنة التلقائية: معطلة 🔒'}
            </span>
          </div>
        </div>

        {/* Sync Feedbacks and Errors */}
        {syncFeedback && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-lg text-xs font-semibold animate-in fade-in duration-200">
            ✅ {syncFeedback}
          </div>
        )}
        {syncError && (
          <div className="p-2.5 bg-amber-50 text-amber-900 border border-amber-150 rounded-lg text-xs font-semibold animate-in fade-in duration-200">
            ⚠️ {syncError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Local records stat */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg py-2.5 px-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10.5px] text-slate-500 font-bold block">إجمالي الإيصالات محلياً (المتصفح)</span>
              <strong className="text-base text-slate-800 font-mono font-black">{payments.length} سند قبض</strong>
            </div>
            <div className="text-base bg-white p-1.5 rounded-md border border-slate-200 shadow-2xs">💻</div>
          </div>

          {/* Cloud records stat */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg py-2.5 px-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10.5px] text-slate-500 font-bold block">المقبوضات المرفوعة سحابياً</span>
              <strong className="text-base text-indigo-900 font-mono font-black">
                {cloudPaymentsCount !== null ? `${cloudPaymentsCount} سند قبض` : '—'}
              </strong>
            </div>
            <div className="text-base bg-white p-1.5 rounded-md border border-slate-200 shadow-2xs">☁️</div>
          </div>

          {/* Status Match check & action */}
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-lg py-2.5 px-3 flex flex-col justify-between gap-1.5">
            <div className="flex justify-between items-center text-[11px]">
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

            <div className="flex items-center gap-1.5 justify-end">
              {pendingQueueCount > 0 && (
                <span className="text-[9.5px] bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.5 rounded-full animate-pulse">
                  {pendingQueueCount} معلقة
                </span>
              )}
              
              <button
                type="button"
                onClick={handleForceSyncFinance}
                disabled={isSyncing}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10.5px] font-black rounded-md transition active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>مزامنة وتأمين الدفاتر الآن</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Upper overview metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 no-print text-right">
        {/* Metric 1 */}
        <PrivacyCard className="bg-white py-3 px-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-slate-500 text-[11px] font-bold">إيرادات المحصلة لـ ({filterMonth})</p>
            <h4 className="text-lg font-black font-sans text-slate-900">{totalReceivedForMonth} ج.م</h4>
            <p className="text-[9.5px] text-slate-400">إجمالي السداد النقدي وحوالات الكاش المقيدة</p>
          </div>
          <div className="bg-slate-50 text-slate-700 p-2.5 rounded-lg border border-slate-200 shrink-0">
            <TrendingUp className="w-4.5 h-4.5" />
          </div>
        </PrivacyCard>

        {/* Metric 2 */}
        <button
          onClick={() => {
            setFilterPaymentStatus('unpaid');
            setActiveSubTab('debtors');
          }}
          className={`py-3 px-3.5 rounded-xl border transition-all text-right flex items-center justify-between cursor-pointer ${
            activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white border-slate-200 hover:border-slate-400 shadow-xs'
          }`}
        >
          <div className="space-y-0.5">
            <p className={`text-[11px] font-bold ${activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid' ? 'text-slate-300' : 'text-slate-500'}`}>المتخلفين عن السداد</p>
            <h4 className={`text-lg font-black font-sans ${activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid' ? 'text-white' : 'text-slate-900'}`}>{debtorsList.filter(d => d.status === 'debtor' && d.amountDue > 0).length} طالب</h4>
            <p className={`text-[9.5px] ${activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid' ? 'text-slate-400' : 'text-red-600 font-bold'}`}>يتطلب تدخلاً ماليًا للمستحقات</p>
          </div>
          <div className={`p-2.5 rounded-lg shrink-0 ${activeSubTab === 'debtors' && filterPaymentStatus === 'unpaid' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-red-50 text-red-600 border border-red-100'}`}>
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        </button>

        {/* Metric 3 */}
        <PrivacyCard className="bg-white py-3 px-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1 w-full text-right">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span className="font-bold">نسبة تحصيل الدفعة للمركز</span>
              <span className="font-black text-slate-900">{collectionPercentage}%</span>
            </div>
            {/* progress line */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  collectionPercentage >= 80 ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
                style={{ width: `${Math.min(collectionPercentage, 100)}%` }}
              />
            </div>
            <p className="text-[9.5px] text-slate-400">المستهدف الشهري الإجمالي: {totalDuesExpectedForMonth} ج.م</p>
          </div>
        </PrivacyCard>
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
              onClick={() => setActiveSubTab('siblings')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'siblings' 
                  ? 'bg-indigo-900 text-white shadow-xs' 
                  : 'bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>تنظيم خصومات الأخوات 👨‍👩‍👧‍👦</span>
              {siblingFamiliesCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black font-mono ${
                  activeSubTab === 'siblings' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-900'
                }`}>
                  {siblingFamiliesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'history' 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>سجل المقبوضات</span>
              {todayPaymentsCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black font-mono ${
                  activeSubTab === 'history' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'
                }`} title={`${todayPaymentsCount} عملية مقبوضات في تاريخ اليوم`}>
                  {todayPaymentsCount} اليوم
                </span>
              )}
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
            <button
              onClick={() => setActiveSubTab('receiptSettings')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'receiptSettings' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-amber-600" />
              <span>تخصيص وتصميم الإيصال 🧾</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">الشهر المالي المستهدف:</span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs font-bold outline-none text-right transition-all"
            >
              {activeSubTab === 'history' && (
                <option value="all">كل الشهور المالية 🗓️</option>
              )}
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters shown ONLY on receipts history and debtors */}
        {(activeSubTab === 'history' || activeSubTab === 'debtors') && (
          <div className="space-y-3">
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

              {/* In debtors: Payment status. In history: Date filter! */}
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
                  <div className="space-y-1.5">
                    <select
                      value={filterDateMode}
                      onChange={(e) => {
                        const mode = e.target.value as 'all' | 'today' | 'custom';
                        setFilterDateMode(mode);
                        if (mode === 'today') {
                          setFilterCustomDate(todayDateStr);
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg text-xs outline-none text-right transition-all font-bold ${
                        filterDateMode === 'today'
                          ? 'bg-emerald-50 text-emerald-950 border-emerald-300 ring-1 ring-emerald-400 shadow-2xs'
                          : filterDateMode === 'custom'
                          ? 'bg-blue-50 text-blue-950 border-blue-300 ring-1 ring-blue-400 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <option value="all">تصفية التاريخ: كل التواريخ 📋</option>
                      <option value="today">تصفية التاريخ: تاريخ اليوم فقط ({todayDateStr}) ⚡</option>
                      <option value="custom">تصفية التاريخ: تحديد تاريخ مخصص... 🗓️</option>
                    </select>
                    {filterDateMode === 'custom' && (
                      <input
                        type="date"
                        value={filterCustomDate}
                        onChange={(e) => setFilterCustomDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs text-right outline-none font-bold text-blue-900 shadow-2xs"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleExportPaymentsExcel}
                  className="w-full px-4 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {filterDateMode === 'today' ? 'تصدير مقبوضات اليوم إكسل' : 'تصدير السجل إكسل'}
                </button>
              </div>
            </div>

            {/* Quick Action Toolbar for Date Filtering in Receipts History */}
            {activeSubTab === 'history' && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/70 p-2.5 rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold text-slate-500">تصفية سريعة:</span>
                  
                  {/* Today's filter button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (filterDateMode === 'today') {
                        setFilterDateMode('all');
                      } else {
                        setFilterDateMode('today');
                        setFilterCustomDate(todayDateStr);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      filterDateMode === 'today'
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/40 scale-101'
                        : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                    }`}
                    title="تصفية سجل المقبوضات حسب تاريخ اليوم بضغطة واحدة"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>مقبوضات تاريخ اليوم ({todayDateStr})</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      filterDateMode === 'today' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {todayPaymentsCount} عملية
                    </span>
                    {todayPaymentsTotal > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-black ${
                        filterDateMode === 'today' ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {todayPaymentsTotal} ج.م
                      </span>
                    )}
                  </button>

                  {/* Show All Dates button */}
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDateMode('all');
                      setFilterCustomDate('');
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterDateMode === 'all'
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    عرض كل التواريخ 📋
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {filterDateMode !== 'all' && (
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      <input
                        type="checkbox"
                        checked={filterDateAllMonths}
                        onChange={(e) => setFilterDateAllMonths(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>شمول كل الشهور المالية لهذا التاريخ</span>
                    </label>
                  )}

                  <div className="text-[11px] font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-2 shadow-2xs">
                    <span>العمليات:</span>
                    <span className="text-slate-900 font-extrabold">{filteredPayments.length}</span>
                    <span className="text-slate-300">|</span>
                    <span>الإجمالي:</span>
                    <span className="text-emerald-700 font-mono font-extrabold">{filteredTotalPaid} ج.م</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Toolbar for Debtors */}
            {activeSubTab === 'debtors' && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/70 p-2.5 rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold text-slate-500">إجراءات سريعة:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentPickerSearch('');
                      setStudentPickerGrade('all');
                      setIsStudentPickerOpen(true);
                    }}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title={`اختيار طالب وتطبيق إعفاء جزئي استثنائي له لشهر (${filterMonth})`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>إعفاء جزئي لطالب لشهر {filterMonth} 🎁</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-2 shadow-2xs">
                    <span>عدد الطلاب:</span>
                    <span className="text-slate-900 font-extrabold">{debtorsList.length}</span>
                    <span className="text-slate-300">|</span>
                    <span>معفى جزئياً بهذا الشهر:</span>
                    <span className="text-purple-700 font-mono font-extrabold">
                      {debtorsList.filter(d => d.student.monthlyExemptions?.[filterMonth]?.type === 'partial').length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Tab Area */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden no-print">
        {/* SUBTAB 1: PAYMENTS HISTORY/LEDGER */}
        {activeSubTab === 'history' && (
          <div className="overflow-x-auto text-right">
            {paymentSuccessFeedback && (
              <div className="p-4 bg-emerald-50/90 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-right animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-950">{paymentSuccessFeedback.msg}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                      تم التقييد في سجل المقبوضات — يمكنك معاينة أو طباعة الإيصال أو إرساله في أي وقت بالضغط على الزر المقابل للعملية.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openReceiptModal(paymentSuccessFeedback.payment, 'preview')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="معاينة أو طباعة الإيصال عند الحاجة"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>معاينة الإيصال عند الحاجة 🧾</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppTextDirect(paymentSuccessFeedback.payment)}
                    className="px-3 py-1.5 bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="إرسال رسالة واتساب مباشرة لولي الأمر"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>إرسال واتساب 📲</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentSuccessFeedback(null)}
                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg transition cursor-pointer"
                    title="إغلاق الإشعار"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-6">اسم الطالب الملتزم</th>
                  <th className="py-3 px-6">الصف الدراسي</th>
                  <th className="py-3 px-6">الشهر المقيد له</th>
                  <th className="py-3 px-6">المبلغ المسدد</th>
                  <th className="py-3 px-6">المطلوب أساساً</th>
                  <th className="py-3 px-6">قناة وتاريخ السداد</th>
                  <th className="py-3 px-6 text-left whitespace-nowrap">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      {filterDateMode === 'today' ? (
                        <div className="space-y-2.5 max-w-md mx-auto py-3">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-slate-700">لا توجد مقبوضات مقيدة في تاريخ اليوم ({todayDateStr})</p>
                          <p className="text-xs text-slate-400">لم يتم تسجيل أي عمليات تحصيل مالية بتاريخ اليوم حتى الآن، أو لا توجد نتائج تطابق معايير البحث.</p>
                          <div className="pt-2 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setFilterDateMode('all')}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                            >
                              عرض كل التواريخ 📋
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveSubTab('add')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                            >
                              + قيد سداد جديد
                            </button>
                          </div>
                        </div>
                      ) : filterDateMode === 'custom' && filterCustomDate ? (
                        <div className="space-y-2.5 max-w-md mx-auto py-3">
                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-slate-700">لا توجد مقبوضات مقيدة في تاريخ ({filterCustomDate})</p>
                          <button
                            type="button"
                            onClick={() => { setFilterDateMode('all'); setFilterCustomDate(''); }}
                            className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            عرض كل التواريخ 📋
                          </button>
                        </div>
                      ) : (
                        <span>لا توجد مدفوعات مقيدة {filterMonth === 'all' ? '' : `لشهر ${filterMonth}`} تتطابق مع التصفية.</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{p.studentName}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            {(() => {
                              const st = students.find(s => s.id === p.studentId || s.name === p.studentName);
                              if (st && st.createdAt) {
                                return (
                                  <span className="flex items-center gap-1 text-slate-600 font-medium">
                                    <Calendar className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    <span>تاريخ التسجيل: <strong className="font-sans text-slate-700 font-semibold">{formatStudentRegistrationDate(st.createdAt)}</strong></span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <span className="text-slate-400 font-mono">• كود المالية: {p.id}</span>
                          </div>
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
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{p.date}</span>
                            {(p.date || '').split('T')[0] === todayDateStr && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-sans font-black shadow-2xs">
                                اليوم ⚡
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-left whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppTextDirect(p)}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg inline-flex items-center justify-center transition cursor-pointer shadow-xs shrink-0"
                              title="إرسال رسالة واتساب نصية فوراً لولي الأمر بضغطة واحدة"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openReceiptModal(p, 'preview')}
                              className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center justify-center transition cursor-pointer shrink-0"
                              title="معاينة وطباعة وتعديل وتنزيل إيصال الاستلام"
                            >
                              <Receipt className="w-3.5 h-3.5 text-slate-600" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingPayment(p)}
                              className="p-1.5 bg-red-50 text-red-650 hover:bg-red-100 border border-red-100 rounded-lg inline-flex items-center justify-center transition cursor-pointer shrink-0"
                              title="حذف العملية من الدفاتر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

                    // Find siblings of this student
                    const cleanPhone = normalizePhoneNumber(student.parentPhone || student.phone);
                    const siblings = cleanPhone && cleanPhone.length >= 8
                      ? students.filter(s => s.id !== student.id && s.status === 'approved' && normalizePhoneNumber(s.parentPhone || s.phone) === cleanPhone)
                      : [];

                    return (
                      <div className="space-y-3">
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
                              <div className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>تاريخ التسجيل: <strong className="font-sans text-slate-700 font-bold">{formatStudentRegistrationDate(student.createdAt)}</strong></span>
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
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-slate-400 font-bold block">حالة الإعفاء/الخصم</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenMonthlyExemption(student, paymentForm.month)}
                                  className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-0.5 cursor-pointer"
                                  title="تطبيق أو تعديل إعفاء جزئي استثنائي لهذا الشهر"
                                >
                                  <Gift className="w-2.5 h-2.5" />
                                  <span>إعفاء شهري</span>
                                </button>
                              </div>
                              <span className="text-xs font-black text-slate-700">
                                {(() => {
                                  const bd = dbEngine.getStudentDiscountsBreakdown(student, paymentForm.month);
                                  if (bd.isFullExemption) {
                                    return '🎁 معفى كلياً (0 ج.م)';
                                  }
                                  if (bd.totalDiscount > 0) {
                                    const parts: string[] = [];
                                    if (bd.permanentDiscount > 0) parts.push(`دائم: ${bd.permanentDiscount}`);
                                    if (bd.monthlyDiscount > 0) parts.push(`شهري: ${bd.monthlyDiscount}`);
                                    if (bd.gradeDiscount > 0) parts.push(`دفعة: ${bd.gradeDiscount}`);
                                    return `📉 خصم (${parts.join(' + ')}) = -${bd.totalDiscount} ج.م`;
                                  }
                                  if (bd.isCustomPrice) {
                                    return `⭐ اشتراك خاص (${bd.basePrice} ج.م)`;
                                  }
                                  return '💵 لا يوجد خصم (كامل)';
                                })()}
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

                        {/* Sibling awareness banner */}
                        {siblings.length > 0 && (
                          <div className="bg-linear-to-r from-indigo-50/90 via-slate-50 to-indigo-50/90 border border-indigo-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-indigo-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                                  <Users className="w-4 h-4" />
                                </div>
                                <div>
                                  <h5 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                                    <span>تنبيه عائلي: هذا الطالب لديه ({siblings.length}) إخوة مسجلين بالسنتر 👨‍👩‍👧‍👦</span>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                                      هاتف الوالد: {student.parentPhone}
                                    </span>
                                  </h5>
                                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    يمكنك تطبيق خصم الأخوات فوراً على هذا الطالب أو التبديل لسداد اشتراك الإخوة.
                                  </p>
                                </div>
                              </div>

                              {/* Quick 1-click Discount Actions for Current Student */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-indigo-900 font-bold">خصم سريع:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated: Student = { ...student, exemptionType: 'partial', discountAmount: 50 };
                                    dbEngine.updateStudent(updated);
                                    onRefresh();
                                    const newDue = dbEngine.calculateStudentDue(updated, paymentForm.month);
                                    setPaymentForm(prev => ({ ...prev, amountPaid: newDue }));
                                  }}
                                  className="px-2.5 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                                  title="تطبيق خصم 50 ج.م على الطالب الحالي"
                                >
                                  -50 ج.م
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated: Student = { ...student, exemptionType: 'partial', discountAmount: 25 };
                                    dbEngine.updateStudent(updated);
                                    onRefresh();
                                    const newDue = dbEngine.calculateStudentDue(updated, paymentForm.month);
                                    setPaymentForm(prev => ({ ...prev, amountPaid: newDue }));
                                  }}
                                  className="px-2.5 py-1 bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                                  title="تطبيق خصم 25 ج.م على الطالب الحالي"
                                >
                                  -25 ج.م
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated: Student = { ...student, exemptionType: 'none', discountAmount: 0 };
                                    dbEngine.updateStudent(updated);
                                    onRefresh();
                                    const newDue = dbEngine.calculateStudentDue(updated, paymentForm.month);
                                    setPaymentForm(prev => ({ ...prev, amountPaid: newDue }));
                                  }}
                                  className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                  title="إلغاء الخصم (سعر كامل)"
                                >
                                  كامل (إلغاء الخصم)
                                </button>
                              </div>
                            </div>

                            {/* Siblings list with their payment status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                              {siblings.map((sib) => {
                                const sibDue = dbEngine.calculateStudentDue(sib, paymentForm.month);
                                const sibPaid = payments
                                  .filter(p => p.studentId === sib.id && p.month === paymentForm.month)
                                  .reduce((sum, p) => sum + p.amountPaid, 0);
                                const sibIsPaid = (sibPaid >= sibDue && sibDue > 0) || (sibDue === 0 && sib.exemptionType === 'full');

                                return (
                                  <div 
                                    key={sib.id}
                                    className="bg-white border border-indigo-150 rounded-xl p-3 flex items-center justify-between gap-2 text-right shadow-2xs"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-extrabold text-slate-900 text-xs">{sib.name}</span>
                                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 rounded">
                                          {sib.code}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                                        <span>{sib.grade}</span>
                                        <span>•</span>
                                        <span className="text-indigo-700 font-bold">
                                          {sib.exemptionType === 'partial' ? `خصم ${sib.discountAmount} ج.م (المطلوب: ${sibDue} ج.م)` : sib.exemptionType === 'full' ? 'معفى كلياً' : `المطلوب: ${sibDue} ج.م`}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {sibIsPaid ? (
                                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg font-extrabold flex items-center gap-1">
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          <span>مسدد</span>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPaymentForm(prev => ({
                                              ...prev,
                                              studentId: sib.id,
                                              amountPaid: sibDue > 0 ? sibDue : prices[sib.grade] || 100,
                                              notes: `سداد اشتراك الأخ (${sib.name}) لشهر ${paymentForm.month}`
                                            }));
                                          }}
                                          className="px-2.5 py-1 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                          title={`التبديل لسداد اشتراك ${sib.name}`}
                                        >
                                          <span>سداد {sibDue} ج.م</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
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
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.grade}) {g.isSpecial || g.type === 'special' ? '⭐ [خاصة]' : ''}
                              </option>
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
                                <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 flex-wrap">
                                  <span>{s.grade}</span>
                                  <span className="text-slate-300">•</span>
                                  <span>المجموعة: {group ? group.name : 'غير محددة'}</span>
                                </div>
                                <div className="text-[9.5px] text-slate-500 font-medium flex items-center gap-1">
                                  <Calendar className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span>تاريخ التسجيل: <strong className="font-sans text-slate-600 font-semibold">{formatStudentRegistrationDate(s.createdAt)}</strong></span>
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
                className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed shadow-xs"
              >
                <Check className="w-4 h-4" />
                تسجيل وحفظ عملية التحصيل في الدفاتر
              </button>
            </div>
          </form>
        )}

        {/* SUBTAB 3: DEBTORS */}
        {activeSubTab === 'debtors' && (
          <div className="overflow-x-auto text-right">
            {dbEngine.isMonthOutsideBillingRange(filterMonth, billingStartMonth, billingEndMonth) && (
              <div className="bg-blue-50/90 p-4 text-blue-900 text-xs font-bold border-b border-blue-150 flex items-center gap-2">
                <AlertCircle className="w-4.5 h-4.5 text-blue-700 flex-shrink-0" />
                <span>تنبيه تنظيم الموازنة: شهر (<strong>{filterMonth}</strong>) خارج النطاق الزمني السنوي المعتمد للمحاسبة (من <strong>{billingStartMonth}</strong> وحتى <strong>{billingEndMonth}</strong>)، لذلك لا يُعتبر الطلاب مدينين فيه ولا تُطلب منهم رسوم.</span>
              </div>
            )}
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
                      <td className="py-3.5 px-6">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900">{student.name}</span>
                            {(() => {
                              const bd = dbEngine.getStudentDiscountsBreakdown(student, filterMonth);
                              if (bd.isFullExemption) {
                                return (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1">
                                    <Gift className="w-3 h-3 text-emerald-600" />
                                    <span>معفى كلياً (0 ج.م)</span>
                                  </span>
                                );
                              }
                              if (bd.totalDiscount > 0) {
                                const labels: string[] = [];
                                if (bd.permanentDiscount > 0) labels.push(`دائم: ${bd.permanentDiscount}`);
                                if (bd.monthlyDiscount > 0) labels.push(`شهري: ${bd.monthlyDiscount}`);
                                if (bd.gradeDiscount > 0) labels.push(`دفعة: ${bd.gradeDiscount}`);
                                return (
                                  <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1" title={`إجمالي الخصم المطبق: ${bd.totalDiscount} ج.م من أصل ${bd.basePrice} ج.م`}>
                                    <Gift className="w-3 h-3 text-purple-600" />
                                    <span>خصم ({labels.join(' + ')}) = -{bd.totalDiscount} ج.م</span>
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <div className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>تاريخ التسجيل: <strong className="font-sans text-slate-700 font-semibold">{formatStudentRegistrationDate(student.createdAt)}</strong></span>
                          </div>
                        </div>
                      </td>
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenMonthlyExemption(student, filterMonth)}
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title={`تطبيق أو تعديل إعفاء جزئي للطالب (${student.name}) لشهر (${filterMonth})`}
                          >
                            <Gift className="w-3.5 h-3.5 text-purple-600" />
                            <span>إعفاء جزئي 🎁</span>
                          </button>

                          {balance <= 0 ? (
                            <span className="text-xs text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100">مكتمل 🟢</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSendDebtorWhatsAppReminder(student, filterMonth, balance, amountDue)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="إرسال رسالة تذكير بالمصروفات لولي الأمر عبر واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>تذكير 💬</span>
                              </button>

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
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBTAB: SIBLINGS & SIBLING DISCOUNTS MANAGER */}
        {activeSubTab === 'siblings' && (
          <div className="p-4 md:p-6 text-right">
            <SiblingDiscountsManager
              students={students}
              payments={payments}
              prices={prices}
              currentMonth={filterMonth}
              onRefresh={onRefresh}
              onSelectStudentForPayment={(studentId, month, dueAmount) => {
                setPaymentForm({
                  studentId,
                  month,
                  amountPaid: dueAmount,
                  paymentMethod: 'نقدي',
                  notes: `سداد اشتراك الأخوة لشهر ${month}`
                });
                setActiveSubTab('add');
              }}
            />
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

              {/* Section 2: Billing Start & End Month settings for Academic Year */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">تحديد النطاق الزمني السنوي للمحاسبة ومطالبة الطلاب بالرسوم</h3>
                  <p className="text-slate-500 text-xs mt-1">
                    تحديد شهري بداية ونهاية العام الدراسي والمحاسبة المالية (مثلاً: تبدأ من أغسطس وتستمر حتى يونيو). الشهور الخارِجة عن هذا النطاق الزمني لن يُطالب فيها التلاميذ برسوم الاشتراك ولا تُحسب كديون.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">شهر بدء المحاسبة (بداية العام)</label>
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">شهر نهاية المحاسبة (نهاية العام)</label>
                    <select
                      value={billingEndMonth}
                      onChange={(e) => setBillingEndMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none text-right transition-all font-bold"
                    >
                      {MONTHS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
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

              {/* Section 4: Individual Monthly Specific Student Exemptions */}
              <div className="border-t border-slate-100 pt-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <Gift className="w-4 h-4 text-purple-600" />
                      <span>إعفاءات وتخفيضات الطلاب الجزئية للشهور المحددة</span>
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                      إدارة الاستثناءات والخصومات الجزئية المطبقة على طلاب محددين في شهور معينة دون تعميمها على باقي الشهور.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentPickerSearch('');
                      setStudentPickerGrade('all');
                      setIsStudentPickerOpen(true);
                    }}
                    className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة إعفاء جزئي شهري لطالب ➕</span>
                  </button>
                </div>

                {(() => {
                  const studentsWithMonthlyExemptions: Array<{ student: Student; month: string; exemption: MonthlyExemption }> = [];
                  students.forEach(s => {
                    if (s.monthlyExemptions) {
                      Object.entries(s.monthlyExemptions).forEach(([m, ex]) => {
                        studentsWithMonthlyExemptions.push({ student: s, month: m, exemption: ex });
                      });
                    }
                  });

                  if (studentsWithMonthlyExemptions.length === 0) {
                    return (
                      <div className="bg-purple-50/40 p-6 rounded-xl border border-dashed border-purple-200 text-center space-y-2">
                        <Gift className="w-8 h-8 text-purple-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">لا توجد إعفاءات جزئية شهرية مخصصة حتى الآن.</p>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                          يمكنك إعفاء أي طالب جزئياً (تخفيض مبلغ معين) لشهر دراسي محدد عبر الضغط على الزر أعلاه أو من خلال جدول المتأخرات أو نافذة تسجيل المقبوضات.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-2xs">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-purple-50/60 text-purple-900 border-b border-purple-100 font-bold">
                            <th className="py-2.5 px-4 font-bold">اسم الطالب</th>
                            <th className="py-2.5 px-4 font-bold">الصف والمجموعة</th>
                            <th className="py-2.5 px-4 font-bold">الشهر المستهدف</th>
                            <th className="py-2.5 px-4 font-bold">نوع وقيمة الخصم</th>
                            <th className="py-2.5 px-4 font-bold">المطلوب بعد الخصم</th>
                            <th className="py-2.5 px-4 font-bold">ملاحظات / السبب</th>
                            <th className="py-2.5 px-4 text-left font-bold">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentsWithMonthlyExemptions.map(({ student, month, exemption }) => {
                            const breakdown = dbEngine.getStudentDiscountsBreakdown(student, month);
                            const due = breakdown.finalDue;
                            return (
                              <tr key={`${student.id}-${month}`} className="hover:bg-slate-50/60 transition">
                                <td className="py-2.5 px-4">
                                  <div className="font-bold text-slate-900">{student.name}</div>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Calendar className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    <span>تاريخ التسجيل: <strong className="font-sans text-slate-700 font-semibold">{formatStudentRegistrationDate(student.createdAt)}</strong></span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-4 text-slate-600 font-medium">
                                  <div>{student.grade}</div>
                                  <span className="text-[10px] text-slate-400 font-mono">كود: {student.code}</span>
                                </td>
                                <td className="py-2.5 px-4 font-bold text-slate-800 font-sans">
                                  <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[11px] font-bold">{month}</span>
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="flex flex-col gap-0.5">
                                    {exemption.type === 'partial' ? (
                                      <span className="font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[11px] w-fit">
                                        خصم شهري: {exemption.discountAmount} ج.م
                                      </span>
                                    ) : (
                                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] w-fit">
                                        إعفاء كامل (0 ج.م)
                                      </span>
                                    )}
                                    {breakdown.permanentDiscount > 0 && (
                                      <span className="text-[10px] text-indigo-700 font-bold">
                                        + خصم دائم مسجل: {breakdown.permanentDiscount} ج.م
                                      </span>
                                    )}
                                    {breakdown.gradeDiscount > 0 && (
                                      <span className="text-[10px] text-amber-700 font-bold">
                                        + خصم الدفعة: {breakdown.gradeDiscount} ج.م
                                      </span>
                                    )}
                                    {breakdown.isCustomPrice && (
                                      <span className="text-[10px] text-slate-500 font-medium">
                                        (سعر أساسي مخصص: {breakdown.basePrice} ج.م)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-4">
                                  <span className="font-mono font-black text-slate-900 text-sm">{due} ج.م</span>
                                  {breakdown.totalDiscount > 0 && (
                                    <span className="text-[10px] text-slate-500 block font-normal">
                                      (إجمالي الخصم: -{breakdown.totalDiscount} ج.م)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-slate-500 font-normal max-w-xs truncate">
                                  {exemption.reason || '—'}
                                </td>
                                <td className="py-2.5 px-4 text-left">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenMonthlyExemption(student, month)}
                                      className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                                      title="تعديل قيمة الخصم"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMonthlyExemption(student, month)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                      title="إلغاء وحذف الخصم لهذا الشهر"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
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
                                <td className="py-2 px-3 border border-slate-900 text-slate-900 font-sans">
                                  <div className="font-bold">{student.name}</div>
                                  <div className="text-[9px] text-slate-500 font-medium">تاريخ التسجيل: {formatStudentRegistrationDate(student.createdAt)}</div>
                                </td>
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
        {/* SUBTAB 6: RECEIPT CUSTOMIZATION & BRANDING */}
        {activeSubTab === 'receiptSettings' && (
          <div className="p-4 md:p-6 text-right">
            <ReceiptCustomizer onRefresh={onRefresh} />
          </div>
        )}
      </div>

      {/* COMPREHENSIVE RECEIPT MODAL (PREVIEW, EDIT DATA & CUSTOMIZE) */}
      {selectedReceiptPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 text-right space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 no-print border border-slate-200 max-h-[92vh] flex flex-col">
            
            {/* Modal Header & Navigation Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
                  <Receipt className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    إيصال الاستلام المالي — {selectedReceiptPayment.studentName}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    سند رقم: <span className="font-mono font-bold text-slate-800">{selectedReceiptPayment.id}</span> • لشهر: <span className="font-bold text-slate-800">{selectedReceiptPayment.month}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <div className="bg-slate-100 p-1 rounded-xl flex gap-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setReceiptModalTab('preview')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      receiptModalTab === 'preview'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>المعاينة والطباعة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptModalTab('edit')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      receiptModalTab === 'edit'
                        ? 'bg-white text-indigo-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>تعديل البيانات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptModalTab('customize')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                      receiptModalTab === 'customize'
                        ? 'bg-white text-amber-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-600" />
                    <span>تخصيص المظهر</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedReceiptPayment(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  title="إغلاق النافذة"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Container with Scroll */}
            <div className="flex-1 overflow-y-auto pr-1 pl-1 space-y-4">
              
              {/* TAB 1: PREVIEW & PRINT */}
              {receiptModalTab === 'preview' && (
                <div className="space-y-4">
                  {/* Notice / Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>المعاينة الحية للإيصال جاهزة ومطابقة للقالب المخصص:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptModalTab('edit')}
                        className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-indigo-700 font-bold rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>تعديل بيانات السند</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptModalTab('customize')}
                        className="px-3 py-1 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-200 text-amber-800 font-bold rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Settings className="w-3 h-3" />
                        <span>تغيير الثيم والنصوص</span>
                      </button>
                    </div>
                  </div>

                  {/* Rendered Live Receipt (standard / thermal) */}
                  <div className="flex justify-center bg-slate-100/70 p-4 rounded-xl border border-slate-200 overflow-x-auto">
                    <div
                      id="payment-receipt-print-area"
                      className={`bg-white rounded-xl border border-slate-300 shadow-sm p-6 text-right space-y-4 text-slate-900 transition-all font-sans relative ${
                        modalReceiptSettings.receiptSize === 'thermal' ? 'w-[320px]' : 'w-[400px]'
                      }`}
                      style={{ direction: 'rtl' }}
                    >
                      {/* Stamp / Watermark if enabled */}
                      {modalReceiptSettings.showStamp && (
                        <div className="absolute top-24 left-6 border-2 border-emerald-600/40 text-emerald-800/50 font-black text-xs px-3 py-1 rounded rotate-[-14deg] pointer-events-none select-none uppercase tracking-widest text-center">
                          مقبوض ومؤكد<br />PAID & VERIFIED
                        </div>
                      )}

                      {/* Header */}
                      <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
                        <div className="font-extrabold text-slate-900 text-base leading-tight">
                          {modalReceiptSettings.centerName || 'مجموعات العلوم المتطورة'}
                        </div>
                        <div className="font-bold text-slate-700 text-xs">
                          {modalReceiptSettings.teacherName || 'الأستاذ محمود أبوذكري'}
                        </div>
                        {modalReceiptSettings.subTitle && (
                          <div className="text-[10px] text-slate-500 font-semibold">
                            {modalReceiptSettings.subTitle}
                          </div>
                        )}
                        {modalReceiptSettings.showPhone && modalReceiptSettings.phone && (
                          <div className="text-[10px] text-slate-500 font-mono font-bold pt-0.5">
                            هاتف / واتساب: {modalReceiptSettings.phone}
                          </div>
                        )}
                      </div>

                      {/* Receipt Title Badge & Numbers */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
                        <span className="bg-slate-900 text-white text-[10px] font-black px-2.5 py-1 rounded">
                          {modalReceiptSettings.receiptTitle || 'إيصال استلام مالي'}
                        </span>
                        <div className="text-left font-mono text-[11px] font-bold text-slate-600">
                          <div>سند: <span className="text-slate-900">{selectedReceiptPayment.id}</span></div>
                          <div className="text-[10px] text-slate-500">{selectedReceiptPayment.date}</div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-200">
                          <span className="text-slate-600 font-bold">اسم الطالب:</span>
                          <span className="font-black text-slate-950 text-sm font-sans">{selectedReceiptPayment.studentName}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-200">
                          <span className="text-slate-600 font-bold">الصف الدراسي:</span>
                          <span className="font-bold text-slate-800">{selectedReceiptPayment.grade}</span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-200">
                          <span className="text-slate-600 font-bold">عن رسوم اشتراك شهر:</span>
                          <span className="font-black text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {selectedReceiptPayment.month}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-200">
                          <span className="text-slate-600 font-bold">طريقة التحصيل:</span>
                          <span className="font-bold text-slate-800">{selectedReceiptPayment.paymentMethod || 'نقدي'}</span>
                        </div>

                        {selectedReceiptPayment.receivedBy && (
                          <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-200">
                            <span className="text-slate-600 font-bold">المستلم / المحصل:</span>
                            <span className="font-bold text-slate-800">{selectedReceiptPayment.receivedBy}</span>
                          </div>
                        )}

                        {modalReceiptSettings.showAmountDue && (
                          <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-200 text-slate-600 font-bold">
                            <span>القيمة المطلوبة أساساً:</span>
                            <span className="font-mono text-slate-800">{selectedReceiptPayment.amountDue} ج.م</span>
                          </div>
                        )}

                        {modalReceiptSettings.showNotes && selectedReceiptPayment.notes && (
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700">
                            <span className="font-bold text-slate-900 block mb-0.5">ملاحظات التحصيل:</span>
                            {selectedReceiptPayment.notes}
                          </div>
                        )}

                        {/* Amount Box */}
                        <div className="bg-slate-900 text-white p-3 rounded-xl flex justify-between items-center mt-2 shadow-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-300 block">المبلغ المقبوض الفعلي</span>
                            <span className="text-xs text-emerald-400 font-bold">سند خالص ومسدد</span>
                          </div>
                          <div className="text-xl font-black font-sans text-emerald-300">
                            {selectedReceiptPayment.amountPaid} <span className="text-xs font-normal text-white">ج.م</span>
                          </div>
                        </div>

                        {/* QR Code and Signature Section */}
                        {(modalReceiptSettings.showQrCode || modalReceiptSettings.showSignature) && (
                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
                            {modalReceiptSettings.showQrCode && (
                              <div className="flex items-center gap-2">
                                <div className="bg-white p-1.5 border border-slate-300 rounded-lg shadow-2xs">
                                  <QRCodeSVG
                                    value={`RECEIPT|${selectedReceiptPayment.id}|${selectedReceiptPayment.studentName}|${selectedReceiptPayment.amountPaid}|${selectedReceiptPayment.month}|${selectedReceiptPayment.date}`}
                                    size={56}
                                    level="M"
                                  />
                                </div>
                                <div className="text-[9px] text-slate-500 font-bold leading-tight">
                                  رمز التحقق الرقمي<br />
                                  <span className="font-mono text-slate-700">{selectedReceiptPayment.id}</span>
                                </div>
                              </div>
                            )}

                            {modalReceiptSettings.showSignature && (
                              <div className="text-center space-y-1">
                                <div className="text-[10px] font-bold text-slate-700">توقيع المستلم</div>
                                <div className="w-24 h-7 border-b border-dashed border-slate-400 flex items-end justify-center text-[10px] text-slate-400">
                                  {modalReceiptSettings.receiverName || selectedReceiptPayment.receivedBy || '................'}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer Message */}
                        {modalReceiptSettings.footerMessage && (
                          <div className="text-center pt-2 border-t border-dashed border-slate-200 text-[10px] text-slate-500 font-bold leading-relaxed">
                            {modalReceiptSettings.footerMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Sharing Hub */}
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-emerald-950">إرسال ومشاركة الإيصال لولي الأمر عبر واتساب</div>
                          <div className="text-[11px] text-emerald-700 font-medium">مشاركة صورة الإيصال كملف/صورة أو إرسال رسالة نصية بكافة تفاصيل السداد</div>
                        </div>
                      </div>

                      {/* Target Phone display / editor */}
                      <div className="flex items-center gap-2">
                        {isEditingPhone ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="tel"
                              value={targetParentPhone}
                              onChange={(e) => setTargetParentPhone(e.target.value)}
                              placeholder="010xxxxxxxx"
                              className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none w-32 focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => setIsEditingPhone(false)}
                              className="p-1 bg-emerald-600 text-white rounded-md text-[10px] font-bold hover:bg-emerald-700 transition cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-xs shadow-2xs">
                            <span className="text-[10px] text-slate-500 font-bold">هاتف ولي الأمر:</span>
                            <span className="font-mono font-bold text-emerald-900">{targetParentPhone || 'غير مسجل (سيفتح واتساب العام)'}</span>
                            <button
                              type="button"
                              onClick={() => setIsEditingPhone(true)}
                              className="p-0.5 text-slate-400 hover:text-emerald-700 transition cursor-pointer"
                              title="تعديل رقم الهاتف المستهدف"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toast feedback if any */}
                    {whatsAppToast && (
                      <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                        whatsAppToast.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                        whatsAppToast.type === 'info' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
                      }`}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>{whatsAppToast.msg}</span>
                      </div>
                    )}

                    {/* Main Action Buttons Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                      {/* 1. Send Image to WhatsApp */}
                      <button
                        type="button"
                        disabled={isGeneratingImage}
                        onClick={() => handleShareOrSendWhatsAppImage(selectedReceiptPayment)}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-emerald-600/20"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ImageIcon className="w-4 h-4" />
                        )}
                        <span>إرسال صورة الإيصال (واتساب) 📲</span>
                      </button>

                      {/* 2. Send Text Details to WhatsApp */}
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppText(selectedReceiptPayment)}
                        className="py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer shadow-sm shadow-emerald-800/20"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>إرسال تفاصيل السداد (نص) 💬</span>
                      </button>

                      {/* 3. Download Image */}
                      <button
                        type="button"
                        disabled={isGeneratingImage}
                        onClick={() => handleDownloadReceiptImage(selectedReceiptPayment)}
                        className="py-2.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
                      >
                        <Download className="w-4 h-4 text-slate-600" />
                        <span>تحميل صورة (PNG) 💾</span>
                      </button>

                      {/* 4. Copy Image / Text */}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={isGeneratingImage}
                          onClick={() => handleCopyReceiptImage(selectedReceiptPayment)}
                          className="flex-1 py-2.5 px-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                          title="نسخ صورة الإيصال إلى الحافظة للصقها مباشرة في واتساب"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                          <span>نسخ الصورة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyWhatsAppText(selectedReceiptPayment)}
                          className="px-3 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
                          title="نسخ نص رسالة الإيصال بالكامل"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          <span>نص</span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable WhatsApp Message Draft Editor */}
                    <div className="border-t border-emerald-200/80 pt-2.5">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setIsEditingMessageDraft(!isEditingMessageDraft)}
                          className="text-xs font-bold text-emerald-850 hover:text-emerald-950 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{isEditingMessageDraft ? 'إخفاء محرر نص الرسالة' : 'معاينة وتخصيص نص رسالة الواتساب قبل الإرسال ✏️'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setReceiptModalTab('customize')}
                          className="text-[11px] font-bold text-emerald-750 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>تعديل القالب العام للمصروفات</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>

                      {isEditingMessageDraft && (
                        <div className="mt-3 bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2.5 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>النص الفعلي الذي سيتم إرساله للرقم:</span>
                            <button
                              type="button"
                              onClick={() => setCustomReceiptMessageDraft(generateReceiptWhatsAppText(selectedReceiptPayment, modalReceiptSettings))}
                              className="text-[11px] text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer font-bold"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>استعادة النص الأصلي</span>
                            </button>
                          </div>
                          <textarea
                            rows={6}
                            value={customReceiptMessageDraft}
                            onChange={(e) => setCustomReceiptMessageDraft(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-850 text-right outline-none focus:bg-white focus:border-emerald-500 font-sans resize-y"
                            placeholder="اكتب نص الرسالة هنا..."
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Print / Additional Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handlePrintCurrentReceipt}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة الإيصال الفوري 🖨️</span>
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptModalTab('edit')}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-700" />
                        <span>تعديل السند</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptPayment(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EDIT PAYMENT DATA FORM */}
              {receiptModalTab === 'edit' && editingReceiptPayment && (
                <form onSubmit={handleSaveEditedReceipt} className="space-y-4">
                  {editReceiptSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>تم حفظ وتحديث بيانات سند الاستلام بنجاح وجارٍ العرض في المعاينة...</span>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>يمكنك تعديل أي بيانات تخص هذا السند المالي (المبلغ، الشهر، تاريخ السداد، المستلم، أو الملاحظات) وسيتم حفظها فوراً في سجلات النظام.</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Student Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم الطالب *</label>
                      <input
                        type="text"
                        required
                        value={editingReceiptPayment.studentName}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, studentName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-bold text-right outline-none"
                      />
                    </div>

                    {/* Grade */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الصف الدراسي *</label>
                      <select
                        value={editingReceiptPayment.grade}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, grade: e.target.value as GradeType })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-bold text-right outline-none"
                      >
                        {ALL_GRADES.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    {/* Month */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">عن شهر *</label>
                      <select
                        value={editingReceiptPayment.month}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, month: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-bold text-right outline-none"
                      >
                        {MONTHS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Amount Paid */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المقبوض الفعلي (ج.م) *</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={editingReceiptPayment.amountPaid}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, amountPaid: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs font-mono font-bold text-emerald-800 text-right outline-none"
                      />
                    </div>

                    {/* Amount Due */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المطلوب أساساً (ج.م)</label>
                      <input
                        type="number"
                        min={0}
                        value={editingReceiptPayment.amountDue || 0}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, amountDue: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-mono font-bold text-slate-700 text-right outline-none"
                      />
                    </div>

                    {/* Payment Date */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ التحصيل *</label>
                      <input
                        type="date"
                        required
                        value={editingReceiptPayment.date}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, date: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-mono font-bold text-right outline-none"
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">طريقة التحصيل *</label>
                      <select
                        value={editingReceiptPayment.paymentMethod || 'نقدي'}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, paymentMethod: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-bold text-right outline-none"
                      >
                        <option value="نقدي">نقدي (في السنتر)</option>
                        <option value="فودافون كاش">فودافون كاش (Vodafone Cash)</option>
                        <option value="فيزا">بطاقة فيزا / ماستر كارد</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>

                    {/* Received By */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستلم / المحصل</label>
                      <input
                        type="text"
                        placeholder="مثال: أ/ محمود أو سكرتارية السنتر"
                        value={editingReceiptPayment.receivedBy || ''}
                        onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, receivedBy: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-bold text-right outline-none"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات السداد وتفاصيل التحصيل</label>
                    <input
                      type="text"
                      placeholder="مثال: تم السداد نقداً مع خصم الأخوات أو عبر المحفظة الإلكترونية..."
                      value={editingReceiptPayment.notes || ''}
                      onChange={(e) => setEditingReceiptPayment({ ...editingReceiptPayment, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs text-right outline-none font-medium"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ التعديلات في السجل المالي</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceiptModalTab('preview')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      العودة للمعاينة
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: CUSTOMIZE LAYOUT & BRANDING FORM */}
              {receiptModalTab === 'customize' && (
                <div className="space-y-4">
                  {modalSettingsSaved && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>تم حفظ وتثبيت إعدادات الإيصال كقالب افتراضي لجميع العمليات بنجاح!</span>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تخصيص نصوص وترويسة ومقاس الإيصال وخيارات إظهار QR Code والتوقيع والختم.</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم المؤسسة / السنتر</label>
                      <input
                        type="text"
                        value={modalReceiptSettings.centerName}
                        onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, centerName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 rounded-lg text-xs font-bold text-right outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم المعلم / المحاضر</label>
                      <input
                        type="text"
                        value={modalReceiptSettings.teacherName}
                        onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, teacherName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 rounded-lg text-xs font-bold text-right outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الوصف الفرعي</label>
                      <input
                        type="text"
                        value={modalReceiptSettings.subTitle}
                        onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, subTitle: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 rounded-lg text-xs text-right outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">عنوان شارة الإيصال</label>
                      <input
                        type="text"
                        value={modalReceiptSettings.receiptTitle}
                        onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, receiptTitle: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 rounded-lg text-xs font-bold text-right outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / الواتساب</label>
                      <input
                        type="text"
                        value={modalReceiptSettings.phone}
                        onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 rounded-lg text-xs font-mono font-bold text-right outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">مقاس وطراز الطباعة</label>
                      <select
                        value={modalReceiptSettings.receiptSize}
                        onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, receiptSize: e.target.value as 'standard' | 'thermal' })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-amber-500 rounded-lg text-xs font-bold text-right outline-none"
                      >
                        <option value="standard">بطاقة مقاس قياسي (Standard Card - 400px)</option>
                        <option value="thermal">طابعة فواتير حرارية (Thermal POS 80mm)</option>
                      </select>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="border-t border-slate-100 pt-3">
                    <label className="block text-xs font-bold text-slate-700 mb-2">عناصر العرض والتحكم في الإيصال:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={modalReceiptSettings.showQrCode}
                          onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, showQrCode: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>رمز QR Code</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={modalReceiptSettings.showSignature}
                          onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, showSignature: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>خانة توقيع المستلم</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={modalReceiptSettings.showStamp}
                          onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, showStamp: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>ختم الاعتماد</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={modalReceiptSettings.showAmountDue}
                          onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, showAmountDue: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>عرض القيمة المطلوبة</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={modalReceiptSettings.showNotes}
                          onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, showNotes: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>عرض الملاحظات</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={modalReceiptSettings.showPhone}
                          onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, showPhone: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <span>عرض رقم الهاتف</span>
                      </label>
                    </div>
                  </div>

                  {/* WhatsApp Message Template Section */}
                  <div className="border-t border-slate-100 pt-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <label className="text-xs font-bold text-slate-800">قالب وتخصيص رسالة الواتساب للإيصال والمصروفات</label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalReceiptSettings({
                          ...modalReceiptSettings,
                          whatsappMessageTemplate: DEFAULT_WHATSAPP_RECEIPT_TEMPLATE
                        })}
                        className="text-[11px] text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>استعادة القالب الافتراضي</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium">
                      يمكنك استخدام المتغيرات التلقائية بالنقر عليها لإدراجها في نص القالب:
                    </p>

                    {/* Variable insertion buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'اسم الطالب', tag: '[اسم_الطالب]' },
                        { label: 'رقم السند', tag: '[رقم_السند]' },
                        { label: 'الصف', tag: '[الصف_الدراسي]' },
                        { label: 'الشهر', tag: '[الشهر]' },
                        { label: 'المبلغ المدفوع', tag: '[المبلغ_المدفوع]' },
                        { label: 'المبلغ المستحق', tag: '[المبلغ_المستحق]' },
                        { label: 'المبلغ المتبقي', tag: '[المبلغ_المتبقي]' },
                        { label: 'التاريخ', tag: '[التاريخ]' },
                        { label: 'طريقة الدفع', tag: '[طريقة_الدفع]' },
                        { label: 'المستلم', tag: '[المستلم]' },
                        { label: 'الملاحظات', tag: '[الملاحظات]' },
                        { label: 'اسم المعلم', tag: '[اسم_المعلم]' },
                        { label: 'اسم السنتر', tag: '[اسم_السنتر]' },
                        { label: 'هاتف التواصل', tag: '[هاتف_التواصل]' },
                        { label: 'رسالة التذييل', tag: '[رسالة_التذييل]' },
                      ].map(v => (
                        <button
                          key={v.tag}
                          type="button"
                          onClick={() => {
                            const current = modalReceiptSettings.whatsappMessageTemplate || DEFAULT_WHATSAPP_RECEIPT_TEMPLATE;
                            setModalReceiptSettings({
                              ...modalReceiptSettings,
                              whatsappMessageTemplate: `${current} ${v.tag}`
                            });
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 transition cursor-pointer"
                        >
                          +{v.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={5}
                      value={modalReceiptSettings.whatsappMessageTemplate || DEFAULT_WHATSAPP_RECEIPT_TEMPLATE}
                      onChange={(e) => setModalReceiptSettings({ ...modalReceiptSettings, whatsappMessageTemplate: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-lg text-xs leading-relaxed text-right outline-none font-sans"
                      placeholder="اكتب قالب رسالة الواتساب..."
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleSaveModalReceiptSettings}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ كإعدادات افتراضية لجميع الإيصالات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceiptModalTab('preview')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      معاينة النتيجة
                    </button>
                  </div>
                </div>
              )}
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

      {/* MONTHLY PARTIAL EXEMPTION MODAL */}
      {monthlyExemptionModal.isOpen && monthlyExemptionModal.student && (() => {
        const student = monthlyExemptionModal.student;
        const targetMonth = monthlyExemptionModal.month;
        const { basePrice, isCustomPrice, customPriceSource } = dbEngine.getStudentBasePrice(student);
        const existingExemption = student.monthlyExemptions?.[targetMonth];
        
        // Previously registered discounts of any type
        const isPermanentFull = student.exemptionType === 'full';
        const permanentDiscount = student.exemptionType === 'partial' ? (student.discountAmount || 0) : 0;
        const gradeDiscount = dbEngine.getGradeMonthDiscounts().find(d => d.grade === student.grade && d.month === targetMonth)?.discount || 0;
        const totalPriorDiscounts = permanentDiscount + gradeDiscount;
        const maxPossibleAdditionalDiscount = Math.max(0, basePrice - totalPriorDiscounts);

        const proposedMonthlyDiscount = isPermanentFull ? 0 : Math.min(maxPossibleAdditionalDiscount, Math.max(0, Number(monthlyExemptionModal.discountAmount) || 0));
        const totalCombinedDiscounts = isPermanentFull ? basePrice : Math.min(basePrice, totalPriorDiscounts + proposedMonthlyDiscount);
        const estimatedDue = isPermanentFull ? 0 : Math.max(0, basePrice - totalCombinedDiscounts);

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-right space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200 max-h-[92vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setMonthlyExemptionModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2.5 text-purple-700">
                  <div className="p-2 bg-purple-100 rounded-xl">
                    <Gift className="w-5 h-5 text-purple-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      إعفاء أو خصم جزئي للطالب لشهر محدد
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      تطبيق خصم استثنائي أو إعفاء جزئي لشهر معين مع مراعاة كافة الخصومات المسجلة مسبقاً
                    </p>
                  </div>
                </div>
              </div>

              {/* Student Info Card & Prior Discounts Overview */}
              <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-black">
                    كود: {student.code}
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">{student.name}</span>
                </div>
                <div className="text-xs text-slate-600 font-medium flex items-center justify-between flex-wrap gap-2">
                  <span>{student.grade}</span>
                  <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>تاريخ التسجيل: <strong className="font-sans text-slate-800 font-bold">{formatStudentRegistrationDate(student.createdAt)}</strong></span>
                  </div>
                </div>

                {/* Section of Previously Registered Discounts & Base Price */}
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-700">
                    <span className="font-bold">السعر الأساسي للطالب:</span>
                    <span className="font-mono font-black text-slate-900">
                      {basePrice} ج.م {isCustomPrice && <span className="text-[10px] text-purple-700 font-sans font-bold">({customPriceSource === 'group' ? 'اشتراك مخصص للمجموعة' : 'اشتراك مخصص للطالب'})</span>}
                    </span>
                  </div>

                  {isPermanentFull ? (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-bold text-[11px] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>الطالب مسجل لديه إعفاء كلي عام بنسبة 100% مسبقاً (المطلوب سداده 0 ج.م تلقائياً).</span>
                    </div>
                  ) : totalPriorDiscounts > 0 ? (
                    <div className="p-2 bg-blue-50/80 border border-blue-200 rounded-lg space-y-1 text-[11px]">
                      <div className="font-extrabold text-blue-900 flex items-center justify-between">
                        <span>الخصومات المسجلة مسبقاً (مأخوذة في الاعتبار بالكامل):</span>
                        <strong className="font-mono text-blue-950 font-black">-{totalPriorDiscounts} ج.م</strong>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                        {permanentDiscount > 0 && (
                          <span className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">
                            📉 خصم دائم مسجل (إعفاء جزئي/إخوة): {permanentDiscount} ج.م
                          </span>
                        )}
                        {gradeDiscount > 0 && (
                          <span className="bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-800 font-bold">
                            🏷️ خصم الدفعة لشهر {targetMonth}: {gradeDiscount} ج.م
                          </span>
                        )}
                      </div>
                      <div className="text-slate-600 pt-0.5 text-[10.5px]">
                        المستحق الحالي قبل تطبيق أي خصم استثنائي: <strong className="font-mono text-slate-900">{maxPossibleAdditionalDiscount} ج.م</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10.5px] text-slate-500 font-medium">
                      لا توجد خصومات دائمية أو خصومات دفعات مسجلة مسبقاً لهذا الطالب.
                    </div>
                  )}

                  {existingExemption && (
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        <span>مطبق حالياً لشهر {targetMonth}: {existingExemption.type === 'partial' ? `خصم جزئي ${existingExemption.discountAmount} ج.م` : 'إعفاء كامل'}</span>
                      </span>
                      {existingExemption.reason && (
                        <span className="text-slate-500 text-[10px] italic">السبب: {existingExemption.reason}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Target Month Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  الشهر الدراسي المستهدف للإعفاء الجزئي:
                </label>
                <select
                  value={monthlyExemptionModal.month}
                  onChange={(e) => handleMonthlyExemptionMonthChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-200 rounded-xl text-xs font-bold outline-none text-right transition"
                >
                  {MONTHS.map(m => (
                    <option key={m} value={m}>
                      شهر {m} {student.monthlyExemptions?.[m] ? `(مطبق عليه إعفاء حالياً ⭐)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount Amount Input & Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between flex-wrap gap-1">
                  <span>قيمة الخصم الجزئي الاستثنائي لشهر {targetMonth} (ج.م):</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    الحد الأقصى المتاح للخصم الإضافي: <strong className="font-mono text-purple-800">{maxPossibleAdditionalDiscount} ج.م</strong>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={maxPossibleAdditionalDiscount}
                    value={monthlyExemptionModal.discountAmount || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMonthlyExemptionModal(prev => ({ ...prev, discountAmount: val }));
                    }}
                    placeholder={`أدخل مبلغ الخصم (من 1 إلى ${maxPossibleAdditionalDiscount})...`}
                    className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-xl text-sm font-bold text-purple-950 outline-none text-right transition"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    ج.م
                  </span>
                </div>

                {/* Quick shortcut buttons */}
                {maxPossibleAdditionalDiscount > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-bold ml-1">خيارات سريعة:</span>
                    {[25, 50, 75, 100].filter(val => val <= maxPossibleAdditionalDiscount).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setMonthlyExemptionModal(prev => ({ ...prev, discountAmount: val }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          monthlyExemptionModal.discountAmount === val
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-purple-50 hover:text-purple-700 border-slate-200'
                        }`}
                      >
                        {val} ج.م
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMonthlyExemptionModal(prev => ({ ...prev, discountAmount: maxPossibleAdditionalDiscount }))}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      title="إعفاء كامل للمبلغ المتبقي لهذا الشهر"
                    >
                      إعفاء كامل المتبقي ({maxPossibleAdditionalDiscount} ج.م)
                    </button>
                  </div>
                )}
              </div>

              {/* Comprehensive Live Preview of Calculations (Taking into account ALL discounts) */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-extrabold text-purple-900 flex items-center justify-between">
                  <span>المعاينة المالية الشاملة لحساب شهر ({targetMonth}):</span>
                  <span className="text-purple-600 font-normal">مراعاة كافة الخصومات المسجلة</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-purple-100">
                    <span className="text-[9.5px] text-slate-400 font-bold block mb-0.5">السعر الأساسي</span>
                    <strong className="font-mono text-slate-700 font-bold">{basePrice} ج.م</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-purple-100">
                    <span className="text-[9.5px] text-blue-600 font-bold block mb-0.5">خصومات سابقة</span>
                    <strong className="font-mono text-blue-700 font-bold">-{totalPriorDiscounts} ج.م</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-purple-100">
                    <span className="text-[9.5px] text-purple-700 font-bold block mb-0.5">خصم الشهر الإضافي</span>
                    <strong className="font-mono text-purple-700 font-extrabold">-{proposedMonthlyDiscount} ج.م</strong>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200 col-span-2 sm:col-span-1">
                    <span className="text-[9.5px] text-emerald-800 font-bold block mb-0.5">المطلوب سداده</span>
                    <strong className="font-mono text-emerald-800 font-black text-sm">{estimatedDue} ج.م</strong>
                  </div>
                </div>
                <div className="text-[10px] text-purple-900/80 text-center font-medium bg-white/70 py-1 px-2 rounded-md border border-purple-100">
                  إجمالي جميع الخصومات المطبقة في هذا الشهر: <strong className="font-mono font-bold text-purple-950">{totalCombinedDiscounts} ج.م</strong> (صافي المستحق: {estimatedDue} ج.م)
                </div>
              </div>

              {/* Reason / Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  سبب أو ملاحظات الإعفاء الجزئي (اختياري):
                </label>
                <input
                  type="text"
                  value={monthlyExemptionModal.reason}
                  onChange={(e) => setMonthlyExemptionModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="مثال: ظروف خاصة، تفوق، اتفاق مسبق مع ولي الأمر..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 focus:border-purple-500 rounded-xl text-xs outline-none text-right transition"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveMonthlyExemption}
                    className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ وتطبيق الخصم لشهر {targetMonth}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonthlyExemptionModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>

                {existingExemption && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMonthlyExemption()}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl font-bold transition text-xs flex items-center gap-1 cursor-pointer"
                    title="حذف هذا الخصم وإرجاع السعر الافتراضي لهذا الشهر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>إلغاء إعفاء هذا الشهر</span>
                  </button>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* STUDENT PICKER MODAL FOR MONTHLY EXEMPTION */}
      {isStudentPickerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 text-right space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200 max-h-[85vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setIsStudentPickerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-purple-700">
                <Gift className="w-5 h-5" />
                <h3 className="text-base font-extrabold text-slate-900">
                  اختيار طالب لتطبيق إعفاء جزئي شهري
                </h3>
              </div>
            </div>

            {/* Search and Grade Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={studentPickerSearch}
                  onChange={(e) => setStudentPickerSearch(e.target.value)}
                  placeholder="ابحث باسم الطالب، الكود أو الهاتف..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-500 rounded-xl text-xs font-semibold outline-none text-right transition"
                  autoFocus
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <select
                value={studentPickerGrade}
                onChange={(e) => setStudentPickerGrade(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-500 rounded-xl text-xs font-bold outline-none text-right transition"
              >
                <option value="all">كل المراحل والصفوف الدراسية</option>
                {ALL_GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/40 max-h-96">
              {(() => {
                const filtered = students.filter(s => {
                  if (s.status !== 'approved') return false;
                  if (studentPickerGrade !== 'all' && s.grade !== studentPickerGrade) return false;
                  if (!studentPickerSearch.trim()) return true;
                  const query = studentPickerSearch.toLowerCase().trim();
                  return (
                    s.name.toLowerCase().includes(query) ||
                    (s.code && s.code.toLowerCase().includes(query)) ||
                    (s.phone && s.phone.includes(query)) ||
                    (s.parentPhone && s.parentPhone.includes(query))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      لا يوجد طلاب مطابقين لخيارات البحث.
                    </div>
                  );
                }

                return filtered.map(s => {
                  const targetMonth = filterMonth || 'أكتوبر';
                  const hasExemptionThisMonth = s.monthlyExemptions?.[targetMonth];

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setIsStudentPickerOpen(false);
                        handleOpenMonthlyExemption(s, targetMonth);
                      }}
                      className="p-3 bg-white hover:bg-purple-50/60 flex items-center justify-between gap-3 transition cursor-pointer group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 group-hover:text-purple-900 transition">{s.name}</span>
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-black">كود: {s.code}</span>
                          {hasExemptionThisMonth && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold">
                              معفى جزئياً لشهر {targetMonth}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold">
                          <span>{s.grade}</span>
                          <span className="mx-1.5">•</span>
                          <span>المجموعة: {allGroups.find(g => g.id === s.groupId)?.name || 'غير محددة'}</span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>تاريخ التسجيل: <strong className="font-sans text-slate-700 font-semibold">{formatStudentRegistrationDate(s.createdAt)}</strong></span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 bg-purple-100 group-hover:bg-purple-700 text-purple-800 group-hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                      >
                        <Gift className="w-3 h-3" />
                        <span>تحديد الخصم</span>
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

          </div>
        </div>
      )}

      {/* FLOATING TOAST FEEDBACK WHEN RECEIPT MODAL IS CLOSED */}
      {whatsAppToast && !selectedReceiptPayment && (
        <div className="fixed bottom-6 left-6 z-50 max-w-md animate-in slide-in-from-bottom-5 fade-in duration-200 pointer-events-auto">
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 shadow-xl border ${
            whatsAppToast.type === 'error' ? 'bg-red-50 text-red-900 border-red-200' :
            whatsAppToast.type === 'info' ? 'bg-blue-50 text-blue-900 border-blue-200' :
            'bg-slate-900 text-white border-slate-700 shadow-slate-900/30'
          }`}>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="leading-snug">{whatsAppToast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
