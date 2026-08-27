/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { dbEngine } from '../db';
import { 
  Student, Payment, GradeType, ExemptionType, SiblingDiscountPolicy, 
  normalizePhoneNumber, ALL_GRADES 
} from '../types';
import { 
  Users, UserCheck, Sparkles, Percent, Tag, Phone, ExternalLink, 
  Copy, Check, CheckCircle2, AlertTriangle, Printer, Download, 
  Search, Filter, ArrowRight, Edit3, Save, X, Receipt, Plus, 
  RefreshCw, Sliders, DollarSign, Gift, ArrowUpRight, MessageSquare, MessageCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PrivacyCard, PrivacyAmount } from './PrivacyAmount';

interface SiblingFamily {
  phoneKey: string;
  parentPhone: string;
  siblings: Student[];
  totalBasePrice: number;
  totalDue: number;
  totalDiscount: number;
  hasDiscount: boolean;
  allPaid: boolean;
  anyPaid: boolean;
}

interface SiblingDiscountsManagerProps {
  students: Student[];
  payments: Payment[];
  prices: Record<GradeType, number>;
  currentMonth: string;
  onRefresh: () => void;
  onSelectStudentForPayment: (studentId: string, month: string, dueAmount: number) => void;
}

export default function SiblingDiscountsManager({
  students,
  payments,
  prices,
  currentMonth,
  onRefresh,
  onSelectStudentForPayment
}: SiblingDiscountsManagerProps) {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterDiscountStatus, setFilterDiscountStatus] = useState<'all' | 'withDiscount' | 'withoutDiscount'>('all');
  
  // Feedback Messages
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Policy Settings state
  const [policy, setPolicy] = useState<SiblingDiscountPolicy>(() => dbEngine.getSiblingDiscountPolicy());
  const [isEditingPolicy, setIsEditingPolicy] = useState(false);
  const [isApplyingPolicy, setIsApplyingPolicy] = useState(false);

  // Modal / Inline Edit for a single student discount
  const [editingStudent, setEditingStudent] = useState<{
    id: string;
    name: string;
    grade: GradeType;
    exemptionType: ExemptionType;
    discountAmount: number;
  } | null>(null);

  const showNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4500);
  };

  // Group approved students into Sibling Families based on normalized parent phone
  const siblingFamilies = useMemo<SiblingFamily[]>(() => {
    const approvedStudents = students.filter(s => s.status === 'approved');
    const phoneGroups: Record<string, Student[]> = {};

    approvedStudents.forEach(st => {
      const cleanPhone = normalizePhoneNumber(st.parentPhone || st.phone);
      if (cleanPhone && cleanPhone.length >= 8) {
        if (!phoneGroups[cleanPhone]) {
          phoneGroups[cleanPhone] = [];
        }
        phoneGroups[cleanPhone].push(st);
      }
    });

    const families: SiblingFamily[] = [];

    Object.entries(phoneGroups).forEach(([phoneKey, rawSiblings]) => {
      if (rawSiblings.length > 1) {
        // Sort siblings in the family by registration date or code
        const sortedSiblings = [...rawSiblings].sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          if (timeA !== timeB) return timeA - timeB;
          return a.code.localeCompare(b.code);
        });

        let totalBasePrice = 0;
        let totalDue = 0;
        let hasDiscount = false;
        let paidCount = 0;

        sortedSiblings.forEach(st => {
          const basePrice = prices[st.grade] || 0;
          const due = dbEngine.calculateStudentDue(st, currentMonth);
          totalBasePrice += basePrice;
          totalDue += due;

          if (st.exemptionType === 'partial' || st.exemptionType === 'full' || (st.discountAmount && st.discountAmount > 0)) {
            hasDiscount = true;
          }

          // Check if paid for current month
          const monthPaid = payments
            .filter(p => p.studentId === st.id && p.month === currentMonth)
            .reduce((sum, p) => sum + p.amountPaid, 0);

          if (monthPaid >= due && due > 0) {
            paidCount++;
          } else if (due === 0 && st.exemptionType === 'full') {
            paidCount++;
          }
        });

        const totalDiscount = Math.max(0, totalBasePrice - totalDue);

        families.push({
          phoneKey,
          parentPhone: sortedSiblings[0].parentPhone || sortedSiblings[0].phone || phoneKey,
          siblings: sortedSiblings,
          totalBasePrice,
          totalDue,
          totalDiscount,
          hasDiscount,
          allPaid: paidCount === sortedSiblings.length,
          anyPaid: paidCount > 0
        });
      }
    });

    // Sort families by count of siblings descending, then by name
    return families.sort((a, b) => {
      if (b.siblings.length !== a.siblings.length) {
        return b.siblings.length - a.siblings.length;
      }
      return a.siblings[0].name.localeCompare(b.siblings[0].name, 'ar');
    });
  }, [students, payments, prices, currentMonth]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalSiblingStudents = 0;
    let discountedStudentsCount = 0;
    let totalMonthlySavings = 0;
    let totalExpectedDues = 0;

    siblingFamilies.forEach(fam => {
      totalSiblingStudents += fam.siblings.length;
      totalMonthlySavings += fam.totalDiscount;
      totalExpectedDues += fam.totalDue;
      fam.siblings.forEach(st => {
        if (st.exemptionType === 'partial' || st.exemptionType === 'full' || st.discountAmount > 0) {
          discountedStudentsCount++;
        }
      });
    });

    return {
      familiesCount: siblingFamilies.length,
      totalSiblingStudents,
      discountedStudentsCount,
      totalMonthlySavings,
      totalExpectedDues
    };
  }, [siblingFamilies]);

  // Filtered Families based on search, grade, and discount status
  const filteredFamilies = useMemo(() => {
    return siblingFamilies.filter(fam => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesPhone = fam.parentPhone.includes(q);
        const matchesAnyName = fam.siblings.some(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
        if (!matchesPhone && !matchesAnyName) return false;
      }

      // Grade filter
      if (filterGrade !== 'all') {
        const hasGrade = fam.siblings.some(s => s.grade === filterGrade);
        if (!hasGrade) return false;
      }

      // Discount Status filter
      if (filterDiscountStatus === 'withDiscount' && !fam.hasDiscount) {
        return false;
      }
      if (filterDiscountStatus === 'withoutDiscount' && fam.hasDiscount) {
        return false;
      }

      return true;
    });
  }, [siblingFamilies, searchQuery, filterGrade, filterDiscountStatus]);

  // Apply Batch Policy to All Families
  const handleApplyBatchPolicy = () => {
    setIsApplyingPolicy(true);
    try {
      dbEngine.setSiblingDiscountPolicy(policy);
      const result = dbEngine.applySiblingDiscountPolicy();
      onRefresh();
      showNotification(
        `تم تطبيق سياسة خصم الإخوة بنجاح على ${result.updatedCount} طالب في ${result.familiesCount} عائلة! ✨`,
        'success'
      );
    } catch (e: any) {
      console.error(e);
      showNotification(`حدث خطأ أثناء تطبيق الخصم: ${e.message}`, 'error');
    } finally {
      setIsApplyingPolicy(false);
    }
  };

  // Reset/Clear All Sibling Discounts
  const handleResetAllSiblingDiscounts = () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء وتصفير جميع خصومات الإخوة لجميع الطلاب والعودة للأسعار الكاملة؟')) {
      return;
    }
    
    const allStudents = dbEngine.getStudents();
    let resetCount = 0;
    const updated = allStudents.map(st => {
      const cleanPhone = normalizePhoneNumber(st.parentPhone || st.phone);
      const isSibling = siblingFamilies.some(fam => fam.phoneKey === cleanPhone);
      if (isSibling && (st.exemptionType === 'partial' || st.discountAmount > 0)) {
        resetCount++;
        return { ...st, exemptionType: 'none' as const, discountAmount: 0 };
      }
      return st;
    });

    dbEngine.setStudents(updated);
    onRefresh();
    showNotification(`تم إلغاء خصومات الإخوة بنجاح لـ ${resetCount} طالب وتصفير الحسابات.`, 'info');
  };

  // Quick send WhatsApp message for sibling
  const handleSendSiblingWhatsApp = (sibling: Student, isPaid: boolean, monthPaid: number, due: number, balance: number) => {
    const rawPhone = sibling.parentPhone || sibling.phone;
    const cleanPhone = normalizePhoneNumber(rawPhone);
    const settings = dbEngine.getReceiptSettings();
    const teacher = settings.teacherName || 'الأستاذ محمود أبوذكري';
    const center = settings.centerName || 'مجموعات العلوم المتطورة';
    
    let text = '';
    if (isPaid) {
      text = `السلام عليكم ورحمة الله وبركاته 🌸\nتحية طيبة لولي أمر الطالب/ـة: *${sibling.name}* المحترم/ـة،\n\nنحيطكم علماً بأنه تم سداد مصروفات شهر *${currentMonth}* لمادة العلوم بمبلغ (*${monthPaid}* ج.م) خالص ومسدد ✅.\n\nشاكرين ومقدرين حسن تعاونكم وثقتكم الغالية 🌟\n👨‍🏫 *${teacher}* - *${center}*`;
    } else {
      const remainingAmount = balance > 0 ? balance : due;
      text = `السلام عليكم ورحمة الله وبركاته 🌸\nتحية طيبة لولي أمر الطالب/ـة: *${sibling.name}* المحترم/ـة،\n\nنود تذكير سيادتكم بمصروفات الاشتراك لشهر *${currentMonth}* (مجموعات العلوم - *${sibling.grade}*):\n🔹 *المبلغ المطلوب:* ${remainingAmount} ج.م (إجمالي الرسوم: ${due} ج.م)\n\nشاكرين ومقدرين دائماً حسن تعاونكم وثقتكم الغالية 🌟\n👨‍🏫 *${teacher}* - *${center}*`;
    }

    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Apply quick discount to a single student
  const handleQuickStudentDiscount = (student: Student, discountAmount: number, exemptionType: ExemptionType = 'partial') => {
    const updatedStudent: Student = {
      ...student,
      exemptionType,
      discountAmount: exemptionType === 'none' ? 0 : discountAmount
    };
    dbEngine.updateStudent(updatedStudent);
    onRefresh();
    
    const label = exemptionType === 'none' 
      ? 'إلغاء الخصم والعودة للسعر الكامل' 
      : exemptionType === 'full' 
      ? 'إعفاء كامل 100%' 
      : `خصم ${discountAmount} ج.م`;
    showNotification(`تم تحديث بيانات الطالب "${student.name}": (${label}) بنجاح.`, 'success');
  };

  // Apply quick discount to an entire family
  const handleQuickFamilyDiscount = (
    family: SiblingFamily, 
    type: 'second_50' | 'all_25' | 'all_50' | 'all_20percent' | 'second_full' | 'reset'
  ) => {
    family.siblings.forEach((st, idx) => {
      const baseGradePrice = prices[st.grade] || 100;
      let newExemption: ExemptionType = st.exemptionType;
      let newDiscount = st.discountAmount;

      if (type === 'reset') {
        newExemption = 'none';
        newDiscount = 0;
      } else if (type === 'second_50') {
        if (idx === 0) {
          newExemption = 'none';
          newDiscount = 0;
        } else {
          newExemption = 'partial';
          newDiscount = Math.min(50, baseGradePrice);
        }
      } else if (type === 'all_25') {
        newExemption = 'partial';
        newDiscount = Math.min(25, baseGradePrice);
      } else if (type === 'all_50') {
        newExemption = 'partial';
        newDiscount = Math.min(50, baseGradePrice);
      } else if (type === 'all_20percent') {
        newExemption = 'partial';
        newDiscount = Math.round(baseGradePrice * 0.20);
      } else if (type === 'second_full') {
        if (idx === 0) {
          newExemption = 'none';
          newDiscount = 0;
        } else {
          newExemption = 'full';
          newDiscount = 0;
        }
      }

      dbEngine.updateStudent({
        ...st,
        exemptionType: newExemption,
        discountAmount: newDiscount
      });
    });

    onRefresh();
    showNotification(`تم تحديث وضبط خصومات عائلة ولي الأمر (${family.parentPhone}) بنجاح! ✨`, 'success');
  };

  // Copy phone number to clipboard
  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Export Sibling Families to Excel
  const handleExportExcel = () => {
    const data: any[] = [];
    let counter = 1;

    siblingFamilies.forEach(fam => {
      fam.siblings.forEach((st, sIdx) => {
        const due = dbEngine.calculateStudentDue(st, currentMonth);
        const basePrice = prices[st.grade] || 0;
        const discount = Math.max(0, basePrice - due);

        // Month paid check
        const paid = payments
          .filter(p => p.studentId === st.id && p.month === currentMonth)
          .reduce((sum, p) => sum + p.amountPaid, 0);

        data.push({
          'م': counter++,
          'رقم عائلة الإخوة': fam.phoneKey,
          'رقم ولي الأمر': fam.parentPhone,
          'ترتيب الأخ في العائلة': `الأخ #${sIdx + 1}`,
          'اسم الطالب': st.name,
          'كود الطالب': st.code,
          'الصف الدراسي': st.grade,
          'سعر الاشتراك الأساسي': `${basePrice} ج.م`,
          'نوع الخصم': st.exemptionType === 'full' ? 'إعفاء كامل 100%' : st.exemptionType === 'partial' ? `خصم ${st.discountAmount} ج.م` : 'لا يوجد خصم',
          'قيمة الخصم الفعلي': `${discount} ج.م`,
          'المستحق المطلوب للدفع': `${due} ج.م`,
          'المبلغ المسدد للشهر': `${paid} ج.م`,
          'حالة السداد': paid >= due && due > 0 ? 'مسدد بالكامل' : due === 0 ? 'معفى' : 'غير مسدد/متبقي',
          'الشهر المالي': currentMonth,
          'إجمالي اشتراك العائلة المطلوب': `${fam.totalDue} ج.م`,
          'إجمالي وفر العائلة شهرياً': `${fam.totalDiscount} ج.م`
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'خصومات_وعائلات_الإخوة');
    XLSX.writeFile(workbook, `تقرير_خصومات_الإخوة_${currentMonth.replace(' ', '_')}.xlsx`);
    showNotification('تم تنزيل ملف الإكسل لكشف خصومات الإخوة بنجاح 📊', 'success');
  };

  // Print Sibling Sheet
  const handlePrintSheet = () => {
    const element = document.getElementById('sibling-discounts-print-area');
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
          <title>طباعة كشف خصومات الأخوات والعائلات</title>
          ${stylesHtml}
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');
            body {
              background-color: white !important;
              color: #0f172a !important;
              padding: 25px !important;
              font-family: 'Cairo', sans-serif !important;
              direction: rtl !important;
              text-align: right !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 15px !important;
              font-size: 11px !important;
            }
            th, td {
              border: 1px solid #334155 !important;
              padding: 6px 8px !important;
              text-align: right !important;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 800 !important;
            }
          </style>
        </head>
        <body>
          <div>
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

  // Save single student edit
  const handleSaveStudentEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const currentStudent = students.find(s => s.id === editingStudent.id);
    if (!currentStudent) return;

    const updated: Student = {
      ...currentStudent,
      exemptionType: editingStudent.exemptionType,
      discountAmount: editingStudent.exemptionType === 'none' ? 0 : Number(editingStudent.discountAmount)
    };

    dbEngine.updateStudent(updated);
    setEditingStudent(null);
    onRefresh();
    showNotification(`تم حفظ وتحديث خصم الطالب "${currentStudent.name}" بنجاح ✨`, 'success');
  };

  return (
    <div className="space-y-6 text-right animate-in fade-in duration-200" id="sibling-discounts-manager">
      
      {/* Toast Notification */}
      {feedbackMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold shadow-sm animate-in slide-in-from-top-3 duration-200 ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : feedbackMessage.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {feedbackMessage.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            {feedbackMessage.type === 'info' && <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button 
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Families */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold block">عائلات الإخوة المشتركة</span>
            <h4 className="text-2xl font-black text-slate-900 font-sans">{summaryMetrics.familiesCount} عائلة</h4>
            <span className="text-[10px] text-indigo-700 font-bold block">مشتركين بنفس رقم الوالد</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Students with Siblings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold block">إجمالي الطلاب الإخوة</span>
            <h4 className="text-2xl font-black text-slate-900 font-sans">{summaryMetrics.totalSiblingStudents} طالب</h4>
            <span className="text-[10px] text-emerald-700 font-bold block">مسجلين بالسنتر بمختلف الصفوف</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Students Receiving Discounts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold block">مستفيدين من الخصم</span>
            <h4 className="text-2xl font-black text-slate-900 font-sans">{summaryMetrics.discountedStudentsCount} طالب</h4>
            <span className="text-[10px] text-amber-700 font-bold block">حاصلين على إعفاء جزئي أو كلي</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
            <Tag className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Total Monthly Sibling Savings */}
        <PrivacyCard className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-bold block">وفر الخصومات الشهري</span>
            <h4 className="text-2xl font-black text-emerald-800 font-sans">{summaryMetrics.totalMonthlySavings} ج.م</h4>
            <span className="text-[10px] text-slate-400 font-bold block">إجمالي الخصم الممنوح شهرياً</span>
          </div>
          <div className="p-3 bg-teal-50 text-teal-700 rounded-xl border border-teal-100">
            <Gift className="w-6 h-6" />
          </div>
        </PrivacyCard>
      </div>

      {/* Section: Smart Sibling Policy & One-Click Automation Panel */}
      <div className="bg-linear-to-r from-slate-900 via-slate-850 to-indigo-950 text-white rounded-2xl p-5 md:p-6 shadow-md space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700/60 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold">
                أداة التنظيم الذكي الشامل ⚡
              </span>
            </div>
            <h3 className="text-base font-black text-white flex items-center gap-2 mt-1">
              <Sliders className="w-4.5 h-4.5 text-indigo-400" />
              سياسة وقواعد خصومات الأخوات التلقائية
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              اضبط قاعدة الخصم الموحدة للإخوة ثم طبقها على جميع العائلات بضغطة زر واحدة لتحديث رسوم جميع الطلاب تلقائياً.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsEditingPolicy(!isEditingPolicy)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isEditingPolicy ? 'إخفاء تخصيص القاعدة' : 'تعديل قاعدة الخصم'}</span>
            </button>

            <button
              onClick={handleApplyBatchPolicy}
              disabled={isApplyingPolicy || siblingFamilies.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              {isApplyingPolicy ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري التطبيق...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>تطبيق القاعدة على جميع الإخوة فوراً 🚀</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Policy Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Rule Overview Tag */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-3.5 space-y-1">
            <span className="text-[11px] text-slate-400 font-bold block">القاعدة المعتمدة حالياً:</span>
            <div className="text-sm font-black text-indigo-300 flex items-center gap-1.5">
              <span>
                {policy.applyTo === 'second_plus' ? 'خصم على الأخ الثاني فما بعد' : 'خصم موحد لجميع الإخوة'}
              </span>
              <span className="text-white font-mono bg-indigo-600/60 px-2 py-0.5 rounded text-xs">
                {policy.type === 'fixed' ? `${policy.amount} ج.م` : `${policy.amount}%`}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {policy.applyTo === 'second_plus' 
                ? 'الأخ الأول يدفع الاشتراك كاملاً، والثاني والثالث يحصلان على الخصم.' 
                : 'كل طالب لديه إخوة يحصل على هذا الخصم شهرياً.'}
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3.5 flex flex-col justify-between gap-2.5">
            <span className="text-[11px] text-slate-400 font-bold">اختيار قاعدة جاهزة وسريعة:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPolicy({ enabled: true, type: 'fixed', amount: 50, applyTo: 'second_plus' });
                  dbEngine.setSiblingDiscountPolicy({ enabled: true, type: 'fixed', amount: 50, applyTo: 'second_plus' });
                  showNotification('تم تحديد القاعدة: خصم 50 ج.م على الأخ الثاني فما بعد.', 'info');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  policy.type === 'fixed' && policy.amount === 50 && policy.applyTo === 'second_plus'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                خصم 50 ج.م على الأخ الثاني
              </button>

              <button
                type="button"
                onClick={() => {
                  setPolicy({ enabled: true, type: 'fixed', amount: 25, applyTo: 'all' });
                  dbEngine.setSiblingDiscountPolicy({ enabled: true, type: 'fixed', amount: 25, applyTo: 'all' });
                  showNotification('تم تحديد القاعدة: خصم 25 ج.م لكل أخ بالعائلة.', 'info');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  policy.type === 'fixed' && policy.amount === 25 && policy.applyTo === 'all'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                خصم 25 ج.م لكل الإخوة
              </button>

              <button
                type="button"
                onClick={() => {
                  setPolicy({ enabled: true, type: 'percentage', amount: 25, applyTo: 'second_plus' });
                  dbEngine.setSiblingDiscountPolicy({ enabled: true, type: 'percentage', amount: 25, applyTo: 'second_plus' });
                  showNotification('تم تحديد القاعدة: خصم 25% على الأخ الثاني.', 'info');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  policy.type === 'percentage' && policy.amount === 25 && policy.applyTo === 'second_plus'
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-xs'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                خصم 25% على الأخ الثاني
              </button>

              <button
                type="button"
                onClick={handleResetAllSiblingDiscounts}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition cursor-pointer mr-auto"
                title="تصفير وإلغاء الخصم لجميع الطلاب"
              >
                إلغاء وتصفير خصومات الإخوة 🔄
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Policy Editor (if open) */}
        {isEditingPolicy && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4 animate-in fade-in duration-200">
            <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              تخصيص مدخلات القاعدة بدقة:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Type */}
              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1">نوع الخصم</label>
                <select
                  value={policy.type}
                  onChange={(e) => setPolicy({ ...policy, type: e.target.value as 'fixed' | 'percentage' })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-bold outline-none"
                >
                  <option value="fixed">مبلغ ثابت بالجنيه (ج.م)</option>
                  <option value="percentage">نسبة مئوية (%) من اشتراك الصف</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1">
                  قيمة الخصم ({policy.type === 'fixed' ? 'جنيه مصري' : 'نسبة مئوية %'})
                </label>
                <input
                  type="number"
                  min={1}
                  max={policy.type === 'percentage' ? 100 : 500}
                  value={policy.amount}
                  onChange={(e) => setPolicy({ ...policy, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-mono font-bold outline-none text-right"
                />
              </div>

              {/* Apply To */}
              <div>
                <label className="block text-[11px] text-slate-300 font-bold mb-1">نطاق تطبيق الخصم</label>
                <select
                  value={policy.applyTo}
                  onChange={(e) => setPolicy({ ...policy, applyTo: e.target.value as 'second_plus' | 'all' })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-bold outline-none"
                >
                  <option value="second_plus">على الأخ الثاني فما بعد فقط (الأول كامل)</option>
                  <option value="all">على جميع الإخوة في العائلة بالتساوي</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  dbEngine.setSiblingDiscountPolicy(policy);
                  setIsEditingPolicy(false);
                  showNotification('تم حفظ إعدادات القاعدة بنجاح.', 'success');
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                حفظ القاعدة فقط
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search, Filter & Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search query */}
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم الطالب أو الكود أو هاتف الوالد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs text-right outline-none transition-all font-medium"
            />
          </div>

          {/* Grade filter */}
          <div>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs outline-none text-right transition-all font-bold text-slate-700"
            >
              <option value="all">كل الصفوف والمراحل الدراسية</option>
              {ALL_GRADES.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Discount Status filter */}
          <div>
            <select
              value={filterDiscountStatus}
              onChange={(e) => setFilterDiscountStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs outline-none text-right transition-all font-bold text-slate-700"
            >
              <option value="all">كل العائلات (مستفيدين وبدون خصم)</option>
              <option value="withDiscount">عائلات مستفيدة من الخصم 🏷️</option>
              <option value="withoutDiscount">عائلات بدون خصم حالياً 💵</option>
            </select>
          </div>

          {/* Export & Print buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              disabled={siblingFamilies.length === 0}
              className="flex-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
              title="تصدير كشف الإخوة إلى ملف Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>إكسل</span>
            </button>

            <button
              onClick={handlePrintSheet}
              disabled={siblingFamilies.length === 0}
              className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
              title="طباعة كشف خصومات الإخوة"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sibling Families List */}
      <div className="space-y-4">
        {filteredFamilies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-700">لا توجد عائلات إخوة مطابقة للبحث أو التصفية الحالية</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              تأكد من إدخال أرقام هواتف أولياء الأمور للطلاب عند تسجيلهم، حيث يقوم النظام بربط وتجميع الإخوة تلقائياً عبر رقم هاتف ولي الأمر المشترك.
            </p>
          </div>
        ) : (
          filteredFamilies.map((family, famIdx) => {
            return (
              <div 
                key={family.phoneKey}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition duration-150"
              >
                {/* Family Header */}
                <div className="bg-slate-50/80 border-b border-slate-200/80 p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-indigo-100 text-indigo-800 p-2.5 rounded-xl font-bold flex items-center gap-1.5 text-xs">
                      <Users className="w-4.5 h-4.5 text-indigo-700" />
                      <span>عائلة #{famIdx + 1}</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm dir-ltr">
                          {family.parentPhone}
                        </span>
                        
                        {/* Copy Phone Button */}
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(family.parentPhone)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
                          title="نسخ رقم الهاتف"
                        >
                          {copiedPhone === family.parentPhone ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* WhatsApp Direct Chat */}
                        <a
                          href={`https://wa.me/${family.parentPhone.startsWith('0') ? '2' + family.parentPhone : family.parentPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 p-1 rounded transition flex items-center gap-0.5 text-[10px] font-bold"
                          title="محادثة واتساب مباشرة مع ولي الأمر"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>واتساب</span>
                        </a>
                      </div>

                      <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
                        <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded text-[10px] border border-indigo-100">
                          {family.siblings.length} إخوة بالسنتر
                        </span>
                        <span>•</span>
                        <span>أسماء الإخوة: {family.siblings.map(s => s.name).join(' ، ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Family Quick Actions & Summary */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                    {/* Family Financial Badge */}
                    <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-right">
                      <span className="text-[10px] text-slate-400 font-bold block">مطلوب العائلة لشهر {currentMonth}</span>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-black text-slate-900 font-mono">{family.totalDue} ج.م</strong>
                        {family.totalDiscount > 0 && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold border border-emerald-100">
                            وفر: {family.totalDiscount} ج.م
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Family Preset Dropdown / Buttons */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleQuickFamilyDiscount(family, 'second_50')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg transition cursor-pointer"
                        title="خصم 50 ج.م على الأخ الثاني فما بعد"
                      >
                        خصم 50 على الأخ الثاني
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickFamilyDiscount(family, 'all_25')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg transition cursor-pointer"
                        title="خصم 25 ج.م لكل الإخوة بالعائلة"
                      >
                        خصم 25 للجميع
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickFamilyDiscount(family, 'all_50')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg transition cursor-pointer"
                        title="خصم 50 ج.م لكل الإخوة بالعائلة"
                      >
                        خصم 50 للجميع
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickFamilyDiscount(family, 'second_full')}
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 rounded-lg transition cursor-pointer"
                        title="إعفاء كامل 100% للأخ الثاني"
                      >
                        إعفاء الثاني
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickFamilyDiscount(family, 'reset')}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="إلغاء الخصم للعائلة والعودة للسعر الكامل"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sibling Students List inside this family */}
                <div className="divide-y divide-slate-100">
                  {family.siblings.map((sibling, sIdx) => {
                    const basePrice = prices[sibling.grade] || 0;
                    const due = dbEngine.calculateStudentDue(sibling, currentMonth);
                    const discount = Math.max(0, basePrice - due);

                    // Check Payment for currentMonth
                    const monthPaid = payments
                      .filter(p => p.studentId === sibling.id && p.month === currentMonth)
                      .reduce((sum, p) => sum + p.amountPaid, 0);

                    const isPaid = (monthPaid >= due && due > 0) || (due === 0 && sibling.exemptionType === 'full');
                    const balance = due - monthPaid;

                    return (
                      <div 
                        key={sibling.id}
                        className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/50 transition"
                      >
                        {/* Sibling Info */}
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            sIdx === 0 
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' 
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          }`}>
                            #{sIdx + 1}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-sm">{sibling.name}</span>
                              <button
                                type="button"
                                onClick={() => handleSendSiblingWhatsApp(sibling, isPaid, monthPaid, due, balance)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-md text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                title={isPaid ? `إرسال رسالة تأكيد سداد المصروفات فوراً لولي أمر (${sibling.name})` : `إرسال رسالة تذكير بالمصروفات فوراً لولي أمر (${sibling.name})`}
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>{isPaid ? 'واتساب السداد 📲' : 'تذكير واتساب 💬'}</span>
                              </button>
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black">
                                {sibling.code}
                              </span>
                              {sIdx === 0 && (
                                <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                  الأخ الأول
                                </span>
                              )}
                              {sIdx > 0 && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold border border-indigo-100">
                                  الأخ الثاني فما بعد
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
                              <span>{sibling.grade}</span>
                              <span>•</span>
                              <span className="text-slate-400">الاشتراك الأساسي: {basePrice} ج.م</span>
                            </div>
                          </div>
                        </div>

                        {/* Status, Amounts & Inline Discount Selector */}
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                          
                          {/* Current Discount Status Badge */}
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold block">موقف الخصم الحالي:</span>
                            <div className="flex items-center gap-1">
                              {sibling.exemptionType === 'full' ? (
                                <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  <Gift className="w-3 h-3" />
                                  إعفاء كامل 100% (0 ج.م)
                                </span>
                              ) : sibling.exemptionType === 'partial' ? (
                                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-emerald-600" />
                                  خصم {sibling.discountAmount} ج.م (المطلوب: {due} ج.م)
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                  بدون خصم (كامل: {due} ج.م)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Discount Clickers for this Student */}
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => handleQuickStudentDiscount(sibling, 0, 'none')}
                              className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                                sibling.exemptionType === 'none'
                                  ? 'bg-white text-slate-900 shadow-xs font-black'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                              title="إلغاء الخصم والعودة للسعر الكامل"
                            >
                              كامل
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickStudentDiscount(sibling, 25, 'partial')}
                              className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                                sibling.exemptionType === 'partial' && sibling.discountAmount === 25
                                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                              }`}
                              title="تطبيق خصم 25 ج.م"
                            >
                              -25
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickStudentDiscount(sibling, 50, 'partial')}
                              className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                                sibling.exemptionType === 'partial' && sibling.discountAmount === 50
                                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                              }`}
                              title="تطبيق خصم 50 ج.م"
                            >
                              -50
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickStudentDiscount(sibling, 100, 'partial')}
                              className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                                sibling.exemptionType === 'partial' && sibling.discountAmount === 100
                                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                              }`}
                              title="تطبيق خصم 100 ج.م"
                            >
                              -100
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickStudentDiscount(sibling, 0, 'full')}
                              className={`px-2 py-1 text-[10px] font-bold rounded transition cursor-pointer ${
                                sibling.exemptionType === 'full'
                                  ? 'bg-purple-600 text-white shadow-xs font-black'
                                  : 'text-purple-700 hover:bg-purple-50'
                              }`}
                              title="إعفاء كامل 100%"
                            >
                              إعفاء
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingStudent({
                                id: sibling.id,
                                name: sibling.name,
                                grade: sibling.grade,
                                exemptionType: sibling.exemptionType,
                                discountAmount: sibling.discountAmount || 0
                              })}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                              title="تخصيص قيمة الخصم بمبلغ محدد"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Payment status for this month */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isPaid ? (
                              <span className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>مسدد ({monthPaid} ج.م)</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectStudentForPayment(sibling.id, currentMonth, balance > 0 ? balance : due)}
                                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                                title="الانتقال الفوري لقيد سداد هذا الطالب"
                              >
                                <DollarSign className="w-3 h-3 text-amber-300" />
                                <span>سداد {balance > 0 ? `${balance} ج.م` : `${due} ج.م`}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Custom Single Student Discount Editor */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-right space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <button
              onClick={() => setEditingStudent(null)}
              className="absolute left-4 top-4 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-lg border border-indigo-100">
                تعديل خصم فردي
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2 font-sans">
                تخصيص خصم الطالب: {editingStudent.name}
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">{editingStudent.grade}</p>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة ونوع الإعفاء / الخصم</label>
                <select
                  value={editingStudent.exemptionType}
                  onChange={(e) => setEditingStudent({ ...editingStudent, exemptionType: e.target.value as ExemptionType })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-xs font-bold outline-none text-right transition"
                >
                  <option value="none">لا يوجد خصم (سداد كامل بدون دعم)</option>
                  <option value="partial">إعفاء جزئي (خصم مبلغ محدد بالجنيه)</option>
                  <option value="full">إعفاء كلي كامل 100% (0 ج.م)</option>
                </select>
              </div>

              {editingStudent.exemptionType === 'partial' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">قيمة الخصم الشهري (جنيه مصري)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={prices[editingStudent.grade] || 500}
                      required
                      value={editingStudent.discountAmount || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, discountAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 pr-4 pl-16 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-lg text-xs text-right font-mono font-bold outline-none"
                      placeholder="مثال: 50"
                    />
                    <div className="absolute left-3 top-2.5 text-[10px] font-bold text-slate-400">جنيه مصري</div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    سعر الاشتراك الأساسي للصف: {prices[editingStudent.grade] || 0} ج.م — المطلوب بعد الخصم:{' '}
                    {Math.max(0, (prices[editingStudent.grade] || 0) - (editingStudent.discountAmount || 0))} ج.م
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ الخصم للطالب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden printable area for sibling sheet */}
      <div className="hidden">
        <div id="sibling-discounts-print-area" className="p-6 bg-white text-right font-sans">
          <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
            <h2 className="text-lg font-black text-slate-900">كشف تنظيم خصومات الأخوات والعائلات</h2>
            <p className="text-xs text-slate-600 font-bold mt-0.5">مجموعات العلوم المتطورة — الأستاذ محمود أبوذكري</p>
            <p className="text-[11px] text-slate-500 font-bold mt-1">شهر المستحقات: {currentMonth} | تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
          </div>

          <table className="w-full text-right border-collapse text-xs border border-slate-900">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-black">
                <th className="py-2 px-2 text-center border border-slate-900">م</th>
                <th className="py-2 px-3 border border-slate-900">هاتف ولي الأمر</th>
                <th className="py-2 px-3 border border-slate-900">اسم الطالب</th>
                <th className="py-2 px-2 text-center border border-slate-900">كود الطالب</th>
                <th className="py-2 px-3 border border-slate-900">الصف الدراسي</th>
                <th className="py-2 px-2 text-center border border-slate-900">الاشتراك الأساسي</th>
                <th className="py-2 px-2 text-center border border-slate-900">قيمة الخصم</th>
                <th className="py-2 px-2 text-center border border-slate-900">المطلوب للدفع</th>
                <th className="py-2 px-3 border border-slate-900">ملاحظات والتوقيع</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let rowCount = 1;
                return siblingFamilies.map((fam) => (
                  fam.siblings.map((st, idx) => {
                    const due = dbEngine.calculateStudentDue(st, currentMonth);
                    const basePrice = prices[st.grade] || 0;
                    const discount = Math.max(0, basePrice - due);
                    return (
                      <tr key={st.id} className="border-b border-slate-300">
                        <td className="py-1.5 px-2 text-center border border-slate-900 font-mono font-bold">{rowCount++}</td>
                        {idx === 0 ? (
                          <td rowSpan={fam.siblings.length} className="py-1.5 px-3 border border-slate-900 font-mono font-bold align-middle bg-slate-50/50">
                            {fam.parentPhone}
                          </td>
                        ) : null}
                        <td className="py-1.5 px-3 border border-slate-900 font-bold">{st.name} {idx > 0 ? `(أخ #${idx + 1})` : '(أخ #1)'}</td>
                        <td className="py-1.5 px-2 text-center border border-slate-900 font-mono">{st.code}</td>
                        <td className="py-1.5 px-3 border border-slate-900">{st.grade}</td>
                        <td className="py-1.5 px-2 text-center border border-slate-900 font-mono">{basePrice} ج.م</td>
                        <td className="py-1.5 px-2 text-center border border-slate-900 font-mono text-emerald-800 font-bold">{discount > 0 ? `${discount} ج.م` : '—'}</td>
                        <td className="py-1.5 px-2 text-center border border-slate-900 font-mono font-black">{due} ج.م</td>
                        <td className="py-1.5 px-3 border border-slate-900"></td>
                      </tr>
                    );
                  })
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
