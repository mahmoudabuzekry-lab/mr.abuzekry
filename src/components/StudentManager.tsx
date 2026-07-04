/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { dbEngine } from '../db';
import { Student, Group, GradeType, ExemptionType } from '../types';
import { 
  UserPlus, Search, Filter, Check, X, QrCode, Trash2, Edit, Printer, 
  Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Save, ShieldAlert,
  MessageSquare, Sparkles, Send, Info
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';

interface StudentManagerProps {
  students: Student[];
  groups: Group[];
  prices: Record<GradeType, number>;
  onRefresh: () => void;
}

export default function StudentManager({ students, groups, prices, onRefresh }: StudentManagerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'new-student' | 'import'>('all');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterExemption, setFilterExemption] = useState<string>('all');

  // Single student states
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Batch A4 printer settings state
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchFilterGrade, setBatchFilterGrade] = useState<string>('all');
  const [batchFilterGroup, setBatchFilterGroup] = useState<string>('all');
  const [cutBorders, setCutBorders] = useState(true);

  // Form states
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    phone: '',
    parentPhone: '',
    grade: 'الصف الثالث الإعدادي' as GradeType,
    school: '',
    address: '',
    groupId: '',
    exemptionType: 'none' as ExemptionType,
    discountAmount: 0,
    notes: ''
  });

  // Importer states
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<{ success?: number; exists?: number; error?: string } | null>(null);

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
    student: Student
  ) => {
    let result = templateText;
    const group = groups.find(g => g.id === student.groupId);
    
    // Prepare values
    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const currentMonth = new Date().toLocaleDateString('ar-EG', { month: 'long' });
    const formattedDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });

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
      '[المبلغ]': String(prices[student.grade] || '0'),
      '[الوقت]': timeNow
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      result = result.replaceAll(placeholder, value);
    });

    return result;
  };

  const handleOpenNotificationModal = (student: Student) => {
    // Determine the logical default template type
    let defaultType: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' = 'attendance';

    // Load templates
    const templates = dbEngine.getTemplates();
    const tpl = templates.find(t => t.type === defaultType) || templates.find(t => t.type === 'custom') || { text: 'السلام عليكم ورحمة الله وبركاته' };
    
    const formattedText = formatNotificationTemplate(tpl.text, student);

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
    
    const formattedText = formatNotificationTemplate(tpl.text, notificationModal.student);
    
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

  // Handle manual additions
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentForm.name.trim()) return;

    // Use selected group or first group of grade
    let targetGroupId = newStudentForm.groupId;
    if (!targetGroupId) {
      const gradeGroups = groups.filter(g => g.grade === newStudentForm.grade);
      if (gradeGroups.length > 0) {
        targetGroupId = gradeGroups[0].id;
      } else {
        setErrorMessage('تنبيه هام: يرجى إنشاء مجموعة وتعيينها لهذا الصف الدراسي أولاً لربط الطالب الجديد بها.');
        return;
      }
    }

    dbEngine.addStudent({
      name: newStudentForm.name,
      phone: newStudentForm.phone,
      parentPhone: newStudentForm.parentPhone,
      grade: newStudentForm.grade,
      school: newStudentForm.school,
      address: newStudentForm.address,
      groupId: targetGroupId,
      exemptionType: newStudentForm.exemptionType,
      discountAmount: Number(newStudentForm.discountAmount),
      notes: newStudentForm.notes,
      status: 'approved' // Created by teacher = approved automatically
    });

    // Reset Form
    setNewStudentForm({
      name: '',
      phone: '',
      parentPhone: '',
      grade: 'الصف الثالث الإعدادي' as GradeType,
      school: '',
      address: '',
      groupId: '',
      exemptionType: 'none',
      discountAmount: 0,
      notes: ''
    });
    
    onRefresh();
    setActiveTab('all');
  };

  // Handle approval of requests
  const handleApprove = (id: string) => {
    dbEngine.updateStudentStatus(id, 'approved');
    onRefresh();
  };

  const handleReject = (id: string) => {
    dbEngine.updateStudentStatus(id, 'rejected');
    onRefresh();
  };

  const handleDelete = (student: Student) => {
    setDeletingStudent(student);
  };

  const confirmDeleteStudent = () => {
    if (!deletingStudent) return;
    dbEngine.deleteStudent(deletingStudent.id);
    setDeletingStudent(null);
    onRefresh();
  };

  // Save changes from editing modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    dbEngine.updateStudent(editingStudent);
    setEditingStudent(null);
    onRefresh();
  };

  // EXCEL / CSV IMPORTER
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryStr = event.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Data preview
        setImportPreview(data);
        setImportStatus(null);
      } catch (err: any) {
        setImportStatus({ error: 'عفواً، فشل قراءة ملف الـ Excel. يرجى التأكد من الصيغة الصحيحة.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const processImport = () => {
    if (importPreview.length === 0) return;

    let successCount = 0;
    let existsCount = 0;

    const currentStudents = dbEngine.getStudents();

    importPreview.forEach((row: any) => {
      const name = row['الاسم بالكامل'] || row['الاسم'] || row['Name'];
      const phone = String(row['رقم الهاتف'] || row['الموبايل'] || row['Phone'] || '');
      const parentPhone = String(row['رقم ولي الأمر'] || row['رقم الوالد'] || row['Parent Phone'] || '');
      const gradeRaw = row['الصف الدراسي'] || row['الصف'] || row['Grade'];
      const school = row['المدرسة'] || row['School'] || '';
      const address = row['العنوان'] || row['Address'] || '';
      const notes = row['ملاحظات'] || row['Notes'] || '';

      // Check duplicate by name or phone
      const isDuplicate = currentStudents.some(
        s => s.name === name || (phone && s.phone === phone)
      );

      if (isDuplicate) {
        existsCount++;
        return;
      }

      // Check if Grade is valid or deduce
      let grade: GradeType = 'الصف الثالث الإعدادي';
      if (gradeRaw) {
        const text = String(gradeRaw);
        if (text.includes('رابع') || text.includes('4')) grade = 'الصف الرابع الابتدائي';
        else if (text.includes('خامس') || text.includes('5')) grade = 'الصف الخامس الابتدائي';
        else if (text.includes('سادس') || text.includes('6')) grade = 'الصف السادس الابتدائي';
        else if (text.includes('أول إعدادي') || text.includes('1 إعدادي') || text.includes('الاول')) grade = 'الصف الأول الإعدادي';
        else if (text.includes('ثاني إعدادي') || text.includes('2 إعدادي') || text.includes('الثاني')) grade = 'الصف الثاني الإعدادي';
        else if (text.includes('ثالث إعدادي') || text.includes('3 إعدادي') || text.includes('الثالث')) grade = 'الصف الثالث الإعدادي';
      }

      // Link to first group of grade
      const gradeGroups = groups.filter(g => g.grade === grade);
      const groupId = gradeGroups.length > 0 ? gradeGroups[0].id : '';

      dbEngine.addStudent({
        name: name || 'طالب مستورد غير مسمى',
        phone,
        parentPhone,
        grade,
        school,
        address,
        groupId,
        exemptionType: 'none',
        discountAmount: 0,
        notes,
        status: 'approved'
      });

      successCount++;
    });

    setImportStatus({ success: successCount, exists: existsCount });
    setImportPreview([]);
    onRefresh();
  };

  // EXPORT TO EXCEL
  const handleExportExcel = () => {
    const dataToExport = students.map((s, idx) => {
      const g = groups.find(group => group.id === s.groupId);
      return {
        'م': idx + 1,
        'الكود': s.code,
        'الاسم بالكامل': s.name,
        'رقم الهاتف': s.phone,
        'رقم ولي الأمر': s.parentPhone,
        'الصف الدراسي': s.grade,
        'المجموعة': g ? g.name : 'غير محدد',
        'المدرسة': s.school,
        'العنوان': s.address,
        'فئة الإعفاء': s.exemptionType === 'none' ? 'لا يوجد' : s.exemptionType === 'full' ? 'إعفاء كامل' : 'إعفاء جزئي',
        'قيمة الخصم': s.discountAmount,
        'الحالة': s.status === 'approved' ? 'نشط/معتمد' : s.status === 'pending' ? 'بانتظار الاعتماد' : 'مرفوض',
        'تاريخ التسجيل': new Date(s.createdAt).toLocaleDateString('ar-EG')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلاب');
    XLSX.writeFile(workbook, 'سجل_الطلاب_العلوم_ابو_ذكري.xlsx');
  };

  // Batch print filtered students helper
  const batchFilteredStudents = students.filter(student => {
    if (student.status !== 'approved') return false;
    const matchesSearch = 
      student.name.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      student.code.toLowerCase().includes(batchSearchQuery.toLowerCase()) ||
      student.phone.includes(batchSearchQuery) ||
      student.parentPhone.includes(batchSearchQuery);

    const matchesGrade = batchFilterGrade === 'all' || student.grade === batchFilterGrade;
    const matchesGroup = batchFilterGroup === 'all' || student.groupId === batchFilterGroup;

    return matchesSearch && matchesGrade && matchesGroup;
  });

  const handleSelectAllBatch = () => {
    const visibleIds = batchFilteredStudents.map(s => s.id);
    setSelectedForBatch(prev => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleDeselectAllBatch = () => {
    const visibleIds = batchFilteredStudents.map(s => s.id);
    setSelectedForBatch(prev => prev.filter(id => !visibleIds.includes(id)));
  };

  const handleLimitBatch = (limit: number) => {
    setSelectedForBatch(batchFilteredStudents.slice(0, limit).map(s => s.id));
  };

  const handlePrintBatchA4 = () => {
    if (selectedForBatch.length === 0) {
      setErrorMessage('الرجاء اختيار طالب واحد على الأقل للتصدير!');
      return;
    }

    const rawElement = document.getElementById('batch-print-layout-raw');
    if (!rawElement) {
      setErrorMessage('حدث خطأ أثناء تحضير كروت الطباعة! يرجى المحاولة مرة أخرى.');
      return;
    }

    const html2canvas = (window as any).html2canvas;
    if (!html2canvas) {
      setErrorMessage('مكتبة تصدير الصور ما زالت قيد التحميل من السيرفر، يرجى المحاولة مرة أخرى بعد ثانيتين.');
      return;
    }

    // Disable button or update text while exporting
    const exportButtonText = document.getElementById('pdf-btn-text');
    const originalText = exportButtonText ? exportButtonText.innerText : 'تصدير وتحميل الكروت كصور (JPG)';
    if (exportButtonText) {
      exportButtonText.innerText = 'جاري توليد وتصدير الصور (JPG)...';
    }

    // Keep track of original style
    const originalStyle = rawElement.getAttribute('style') || '';

    // Temporarily position it within the viewport underneath everything (so html2canvas can measure & render perfectly)
    rawElement.setAttribute('style', 'position: fixed; left: 0; top: 0; width: 210mm; background-color: #ffffff; z-index: -9999; opacity: 1; pointer-events: none;');

    // Find all rendered printable card pages
    const pages = rawElement.querySelectorAll('.a4-print-page');
    if (pages.length === 0) {
      setErrorMessage('عذراً، لم يتم العثور على صفحات جاهزة للتصدير كصور.');
      if (exportButtonText) {
        exportButtonText.innerText = originalText;
      }
      rawElement.setAttribute('style', originalStyle);
      return;
    }

    let currentIndex = 0;

    const exportNextPage = () => {
      if (currentIndex >= pages.length) {
        // Completed all page images successfully
        if (exportButtonText) {
          exportButtonText.innerText = originalText;
        }
        rawElement.setAttribute('style', originalStyle);
        return;
      }

      const pageEl = pages[currentIndex] as HTMLElement;

      // Render the page element to a Canvas with high-density scale (2.5x) for crisp QR codes & text
      html2canvas(pageEl, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff'
      }).then((canvas: HTMLCanvasElement) => {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.href = imgData;
        link.download = `كروت_الطلاب_صفحة_${currentIndex + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Advance to next page with a small timeout to let the UI thread breathe
        currentIndex++;
        setTimeout(exportNextPage, 300);
      }).catch((err: any) => {
        console.error('Error generating image page:', err);
        currentIndex++;
        exportNextPage();
      });
    };

    // Give the browser 150ms to reflow and render the layout before starting the capture
    setTimeout(() => {
      exportNextPage();
    }, 150);
  };

  // Filtering Logic
  const filteredStudents = students.filter(student => {
    if (student.status !== 'approved') return false;
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.phone.includes(searchQuery) ||
      student.parentPhone.includes(searchQuery);

    const matchesGrade = filterGrade === 'all' || student.grade === filterGrade;
    const matchesGroup = filterGroup === 'all' || student.groupId === filterGroup;
    const matchesExemption = filterExemption === 'all' || student.exemptionType === filterExemption;

    return matchesSearch && matchesGrade && matchesGroup && matchesExemption;
  });

  const approvedCount = students.filter(s => s.status === 'approved').length;
  const pendingCount = students.filter(s => s.status === 'pending').length;

  // Group selected students for printing (8 cards per page)
  const studentsToPrint = students.filter(s => selectedForBatch.includes(s.id));
  const cardsPerPage = 8;
  const printPages: Student[][] = [];
  for (let i = 0; i < studentsToPrint.length; i += cardsPerPage) {
    printPages.push(studentsToPrint.slice(i, i + cardsPerPage));
  }

  return (
    <div className="space-y-6" id="student-manager">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold">الطلاب المعتمدين</p>
            <h4 className="text-2xl font-bold font-sans text-slate-800 mt-1">{approvedCount} طالب</h4>
          </div>
          <div className="bg-slate-50 text-slate-700 border border-slate-100 p-3 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('pending')}
          className={`p-5 rounded-xl shadow-xs border text-right transition-all flex items-center justify-between ${
            activeTab === 'pending' 
              ? 'bg-amber-600 text-white border-amber-600' 
              : 'bg-white text-slate-705 border-slate-200 hover:border-amber-300'
          }`}
        >
          <div>
            <p className={`${activeTab === 'pending' ? 'text-white/85' : 'text-slate-500'} text-xs font-bold`}>طلبات التسجيل الجديدة</p>
            <h4 className="text-2xl font-bold font-sans mt-1">{pendingCount} طالب</h4>
          </div>
          <div className={`p-3 rounded-lg ${activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </button>

        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 flex items-center justify-between md:col-span-2">
          <div className="space-y-1">
            <span className="text-[10px] bg-slate-50 text-slate-800 border border-slate-200 px-2.5 py-0.5 rounded font-bold">ذكي واحترافي</span>
            <p className="text-slate-850 font-bold text-sm pt-1">توليد الكروت الذكية واستيراد الإكسيل</p>
            <p className="text-slate-500 text-xs leading-normal">إصدار الهوية الرقمية للطلبة مباشرة فور القبول لمسح الحضور والدفع السريع بالأجهزة.</p>
          </div>
        </div>
      </div>

      {/* Navigation & Controls */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 space-y-4 no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setActiveTab('all'); setSelectedStudentForCard(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              عرض جميع الطلاب
            </button>
            <button
              onClick={() => { setActiveTab('pending'); setSelectedStudentForCard(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold relative transition-all ${
                activeTab === 'pending' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              الطلبات المعلقة
              {pendingCount > 0 && (
                <span className="absolute -top-1 -left-1 bg-red-650 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('new-student'); setSelectedStudentForCard(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'new-student' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              إضافة طالب يدوي
            </button>
            <button
              onClick={() => { setActiveTab('import'); setSelectedStudentForCard(null); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'import' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              استيراد إكسل
            </button>
          </div>

          <div className="flex flex-wrap gap-2 space-x-2 space-x-reverse justify-end">
            <button 
              onClick={() => {
                const approvedOnly = filteredStudents.filter(s => s.status === 'approved').map(s => s.id);
                setSelectedForBatch(approvedOnly);
                setBatchFilterGrade(filterGrade);
                setBatchFilterGroup(filterGroup);
                setBatchSearchQuery('');
                setShowBatchPrintModal(true);
              }}
              className="px-4 py-2 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة كروت الطلاب (A4)
            </button>
            <button 
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-50 text-emerald-850 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              تصدير السجل إكسل
            </button>
          </div>
        </div>

        {/* Tab content conditional filters (only on "all" tab) */}
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث باسم الطالب، الكود، أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none transition-all text-right"
              />
            </div>

            {/* Grade Filter */}
            <div>
              <select
                value={filterGrade}
                onChange={(e) => { setFilterGrade(e.target.value); setFilterGroup('all'); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none transition-all text-right"
              >
                <option value="all">كل المراحل والصفوف</option>
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
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none transition-all text-right"
              >
                <option value="all">كل المجموعات</option>
                {groups
                  .filter(g => filterGrade === 'all' || g.grade === filterGrade)
                  .map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.grade})</option>
                  ))
                }
              </select>
            </div>

            {/* Exemption Filter */}
            <div>
              <select
                value={filterExemption}
                onChange={(e) => setFilterExemption(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs outline-none transition-all text-right"
              >
                <option value="all">كل الحالات المالية</option>
                <option value="none">اشتراك عادي كامل</option>
                <option value="partial">خصم جزئي</option>
                <option value="full">إعفاء من الرسوم</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Area */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden no-print">
        {/* TAB 1: ALL STUDENTS */}
        {activeTab === 'all' && (
          <div className="overflow-x-auto text-right">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-6 font-semibold">كود الطالب</th>
                  <th className="py-3 px-6 font-semibold">اسم الطالب</th>
                  <th className="py-3 px-6 font-semibold">الصف والمجموعة</th>
                  <th className="py-3 px-6 font-semibold">المدرسة / العنوان</th>
                  <th className="py-3 px-6 font-semibold">رقم الهاتف / ولي الأمر</th>
                  <th className="py-3 px-6 font-semibold">الحالة المالية</th>
                  <th className="py-3 px-6 font-semibold text-left">التحكم والعمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-405">
                      لا يوجد متعلمين يطابقون خيارات التصفية المدخلة.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const group = groups.find(g => g.id === s.groupId);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-6 font-mono font-medium text-slate-900">{s.code}</td>
                        <td className="py-3.5 px-6">
                          <div className="font-bold text-slate-800">{s.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">تاريخ التسجيل: {new Date(s.createdAt).toLocaleDateString('ar-EG')}</div>
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="font-medium text-slate-700">{s.grade}</div>
                          <div className="text-[10px] text-slate-600 bg-slate-100/85 font-bold inline-block px-2 py-0.5 mt-1 rounded">{group ? group.name : 'غير مخصصة'}</div>
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="text-slate-700">{s.school}</div>
                          <div className="text-[10px] text-slate-400">{s.address}</div>
                        </td>
                        <td className="py-3.5 px-6 font-mono text-slate-600 space-y-0.5">
                          <div>الطالب: {s.phone || '—'}</div>
                          <div className="text-slate-800 font-bold">الأب: {s.parentPhone}</div>
                        </td>
                        <td className="py-3.5 px-6">
                          {s.exemptionType === 'none' ? (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 border border-slate-200 rounded font-bold">عادي ({prices[s.grade]} ج.م)</span>
                          ) : s.exemptionType === 'full' ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded font-bold border border-emerald-100">إعفاء كامل (مكرمة)</span>
                          ) : (
                            <span className="text-[10px] bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded font-bold border border-amber-100">خصم جزئي ({s.discountAmount} ج.م)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-left space-x-1.5 space-x-reverse">
                          <button
                            onClick={() => setSelectedStudentForCard(s)}
                            title="إصدار الكارت الذكي"
                            className="p-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg inline-flex items-center transition-all border border-slate-200 cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenNotificationModal(s)}
                            title="إرسال إشعار WhatsApp ذكي"
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg inline-flex items-center transition-all border border-emerald-100 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingStudent({ ...s })}
                            title="تعديل بيانات"
                            className="p-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg inline-flex items-center transition-all border border-slate-200 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            title="حذف الطالب"
                            className="p-1.5 bg-red-50 text-red-650 hover:bg-red-100 rounded-lg inline-flex items-center transition-all border border-red-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: PENDING APPROVAL REQUESTS */}
        {activeTab === 'pending' && (
          <div className="overflow-x-auto text-right">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                  <th className="py-4 px-6 font-semibold">تاريخ التقديم</th>
                  <th className="py-4 px-6 font-semibold">اسم الطالب المتقدم</th>
                  <th className="py-4 px-6 font-semibold">المرحلة والمجموعة المطلوبة</th>
                  <th className="py-4 px-6 font-semibold">المدرسة / العنوان</th>
                  <th className="py-4 px-6 font-semibold">رقم الاتصال (الوالد)</th>
                  <th className="py-4 px-6 font-semibold">ملاحظات دقيقة</th>
                  <th className="py-4 px-6 font-semibold text-center">الإجراء الفوري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.filter(s => s.status === 'pending').length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-500">
                      لا يوجد طلبات تسجيل معلقة جديدة حالياً. الكل معتمد ومحدث بنجاح!
                    </td>
                  </tr>
                ) : (
                  students.filter(s => s.status === 'pending').map((s) => {
                    const group = groups.find(g => g.id === s.groupId);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-mono text-gray-500">
                          {new Date(s.createdAt).toLocaleDateString('ar-EG')}<br />
                          {new Date(s.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-4 px-6 font-bold text-gray-800">{s.name}</td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-700">{s.grade}</div>
                          <div className="text-xs text-sky-600 bg-sky-50 font-medium inline-block px-2 py-0.5 mt-1 rounded-sm">{group ? group.name : 'أول مجموعة تلقائية'}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-gray-700">{s.school}</div>
                          <div className="text-xs text-gray-400">{s.address}</div>
                        </td>
                        <td className="py-4 px-6 font-mono text-gray-800 font-medium">{s.parentPhone}</td>
                        <td className="py-4 px-6 text-gray-500 max-w-xs truncate">{s.notes || '—'}</td>
                        <td className="py-4 px-6 text-center">
                          <div className="inline-flex space-x-1.5 space-x-reverse">
                            <button
                              onClick={() => handleApprove(s.id)}
                              className="px-3.5 py-1.5 bg-emerald-600 label-shadow text-white hover:bg-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              قبول واعتماد
                            </button>
                            <button
                              onClick={() => handleReject(s.id)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                              رفض الطلب
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

        {/* TAB 3: NEW STUDENT FORM (MANUAL) */}
        {activeTab === 'new-student' && (
          <form onSubmit={handleAddStudent} className="p-6 md:p-8 space-y-6 text-right">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-3">إدخال طالب جديد بسجلات السنتر</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم ثلاثي أو رباعي بالكامل *</label>
                <input
                  type="text"
                  required
                  value={newStudentForm.name}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                  placeholder="مثال: أحمد يحيى عثمان سليمان"
                  className="w-full px-4 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all"
                />
              </div>

              {/* Student Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">رقم هاتف الطالب (شخصياً)</label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  value={newStudentForm.phone}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all font-mono"
                />
              </div>

              {/* Parent Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">رقم هاتف ولي الأمر (ضروري لإشعارات الـ WhatsApp) *</label>
                <input
                  type="tel"
                  required
                  placeholder="01xxxxxxxxx"
                  value={newStudentForm.parentPhone}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, parentPhone: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all font-mono"
                />
              </div>

              {/* Grade */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">الصف الدراسي *</label>
                <select
                  required
                  value={newStudentForm.grade}
                  onChange={(e) => {
                    const grade = e.target.value as GradeType;
                    // Auto select first group of new grade
                    const gradeGroups = groups.filter(g => g.grade === grade);
                    setNewStudentForm({ 
                      ...newStudentForm, 
                      grade,
                      groupId: gradeGroups.length > 0 ? gradeGroups[0].id : ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all"
                >
                  <option value="الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>
                  <option value="الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>
                  <option value="الصف السادس الابتدائي">الصف السادس الابتدائي</option>
                  <option value="الصف الأول الإعدادي">الصف الأول الإعدادي</option>
                  <option value="الصف الثاني الإعدادي">الصف الثاني الإعدادي</option>
                  <option value="الصف الثالث الإعدادي">الصف الثالث الإعدادي</option>
                </select>
              </div>

              {/* Group */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">المجموعة الدراسية المربوط بها *</label>
                <select
                  required
                  value={newStudentForm.groupId}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, groupId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all"
                >
                  <option value="">اختر المجموعة...</option>
                  {groups
                    .filter(g => g.grade === newStudentForm.grade)
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name} - ({g.day} : {g.time})</option>
                    ))
                  }
                </select>
              </div>

              {/* School */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">المدرسة التابع لها الطالب</label>
                <input
                  type="text"
                  placeholder="مثال: مدرسة التحرير الرسمية"
                  value={newStudentForm.school}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, school: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">العنوان بالتفصيل</label>
                <input
                  type="text"
                  placeholder="تحديد الشارع أو القرية لسهولة تجميع الطلاب"
                  value={newStudentForm.address}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, address: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all"
                />
              </div>

              {/* Exemption Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">حالة الإعفاء المالي والاشتراك</label>
                <select
                  value={newStudentForm.exemptionType}
                  onChange={(e) => {
                    const exemptionType = e.target.value as ExemptionType;
                    setNewStudentForm({ ...newStudentForm, exemptionType, discountAmount: exemptionType !== 'partial' ? 0 : newStudentForm.discountAmount });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all"
                >
                  <option value="none">طالب عادي بغير خصم</option>
                  <option value="partial">خصم أو تخفيض جزئي مستمر</option>
                  <option value="full">إعفاء تام ومجاني بالكامل</option>
                </select>
              </div>

              {/* Discount Amount */}
              {newStudentForm.exemptionType === 'partial' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">قيمة الخصم بالجنيه المصري مخصصة للدرس</label>
                  <input
                    type="number"
                    min={0}
                    max={prices[newStudentForm.grade]}
                    value={newStudentForm.discountAmount}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, discountAmount: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all font-mono"
                  />
                  <p className="text-xs text-amber-600 mt-1">سعر اشتراك الصف الحالي: {prices[newStudentForm.grade]} ج.م</p>
                </div>
              )}
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">ملاحظات إضافية (أقرباء، متفوق، مواصفات طبية...)</label>
              <textarea
                rows={3}
                placeholder="أدخل أي ملفات أو ملاحظات إدارية ترغب بتذكرها للطالب لاحقاً..."
                value={newStudentForm.notes}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, notes: e.target.value })}
                className="w-full p-4 bg-slate-50 border border-gray-200 focus:border-sky-500 focus:bg-white focus:ring-1 focus:ring-sky-500 rounded-xl text-right text-sm outline-hidden transition-all"
              />
            </div>

            <div className="flex justify-start">
              <button
                type="submit"
                className="px-6 py-2.5 bg-sky-600 label-shadow text-white rounded-xl text-sm font-bold flex items-center gap-1 hover:bg-sky-700 transition"
              >
                <Save className="w-4 h-4" />
                حفظ وتسجيل الطالب بالمجموعة
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: IMPORT EXCEL */}
        {activeTab === 'import' && (
          <div className="p-6 md:p-8 space-y-6 text-right">
            <div>
              <h3 className="text-lg font-bold text-slate-800">استيراد بيانات الطلاب جماعياً عبر ملف Excel / CSV</h3>
              <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                وفر وقتك وقم بـرفع سجلات الطلاب بضغطة زر واحدة. يتعرف النظام الذكي تلقائياً على الأعمدة المطابقة.
              </p>
            </div>

            {/* Template Card */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-dashed border-gray-300 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 space-x-3 space-x-reverse">
                <div className="bg-emerald-100 text-emerald-700 p-3 rounded-xl">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">نموذج الملف المتطابق لإنشاء السجل</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    يفضل أن يحتوي الملف على هذه الأعمدة: <strong>الاسم بالكامل</strong>، <strong>رقم الهاتف</strong>، <strong>رقم ولي الأمر</strong>، <strong>الصف الدراسي</strong>، <strong>المدرسة</strong>، <strong>العنوان</strong>، <strong>ملاحظات</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const headers = [['الاسم بالكامل', 'رقم الهاتف', 'رقم ولي الأمر', 'الصف الدراسي', 'المدرسة', 'العنوان', 'ملاحظات']];
                  const ws = XLSX.utils.aoa_to_sheet(headers);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'شيت_التسجيل');
                  XLSX.writeFile(wb, 'نموذج_الأستاذ_محمود_ابو_ذكري_تسجيل.xlsx');
                }}
                className="px-4 py-2 bg-white text-gray-700 hover:bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold whitespace-nowrap transition"
              >
                تحميل نموذج الشيت الفارغ
              </button>
            </div>

            {/* File Input */}
            <div className="border-4 border-dashed border-slate-100 hover:bg-slate-50/50 p-8 rounded-2xl text-center space-y-3 cursor-pointer relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelUpload}
                className="absolute inset-0 opacity-0 w-full cursor-pointer h-full"
              />
              <Upload className="w-10 h-10 mx-auto text-sky-500" />
              <div className="font-bold text-gray-700 text-sm">اضغط هنا لرفع ملف الـ Excel أو السجل المطلوب</div>
              <p className="text-xs text-gray-400">يدعم تنسيقات XLS, XLSX, CSV - حجم أقصى 10 ميجابايت</p>
            </div>

            {/* Status Feedback */}
            {importStatus?.error && (
              <div className="p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{importStatus.error}</span>
              </div>
            )}

            {importStatus?.success !== undefined && (
              <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl space-y-1">
                <div className="font-bold">اكتملت عملية المعالجة!</div>
                <p className="text-sm">
                  تم استيراد واعتماد <strong>{importStatus.success}</strong> طالب بنجاح في السنتر. 
                  (تم تخطي <strong>{importStatus.exists}</strong> سجل لتكرار الأسماء أو الأرقام كإجراء أمان).
                </p>
              </div>
            )}

            {/* Preview of uploaded data */}
            {importPreview.length > 0 && (
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center bg-sky-50/60 p-4 rounded-xl border border-sky-100">
                  <div className="text-right">
                    <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-medium">خطوة المعاينة</span>
                    <h4 className="font-bold text-sky-900 mt-1">تمت معالجة {importPreview.length} سطر في الملف بنجاح!</h4>
                  </div>
                  <button
                    onClick={processImport}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-sm shadow-sm transition"
                  >
                    حفظ واستيراد كافة البيانات المعروضة
                  </button>
                </div>

                <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-right border-collapse text-gray-600">
                    <thead className="bg-slate-100 text-gray-700 border-b">
                      <tr>
                        <th className="p-3">الاسم بالكامل</th>
                        <th className="p-3">رقم الهاتف</th>
                        <th className="p-3 font-semibold">رقم الوالد</th>
                        <th className="p-3">الصف</th>
                        <th className="p-3">المدرسة</th>
                        <th className="p-3">العنوان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold">{row['الاسم بالكامل'] || row['الاسم'] || row['Name'] || '—'}</td>
                          <td className="p-3 font-mono">{row['رقم الهاتف'] || row['الموبايل'] || row['Phone'] || '—'}</td>
                          <td className="p-3 font-mono font-medium text-slate-800">{row['رقم ولي الأمر'] || row['رقم الوالد'] || row['Parent Phone'] || '—'}</td>
                          <td className="p-3">{row['الصف الدراسي'] || row['الصف'] || row['Grade'] || '—'}</td>
                          <td className="p-3">{row['المدرسة'] || row['School'] || '—'}</td>
                          <td className="p-3">{row['العنوان'] || row['Address'] || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importPreview.length > 5 && (
                  <p className="text-xs text-gray-400 italic text-left">... وهناك {importPreview.length - 5} سطر إضافي لم يعرض في المعاينة الفورية للأمان.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT MODAL DIALOG */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setEditingStudent(null)}
              className="absolute left-4 top-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-500 transition-all border"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
              <Edit className="w-5 h-5 text-sky-600" />
              تعديل سجل الطالب المستدام
            </h3>

            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الاسم بالكامل</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">كود الطالب الثابت</label>
                <input
                  type="text"
                  disabled
                  value={editingStudent.code}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-right font-mono text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الموبايل الشخصي</label>
                <input
                  type="tel"
                  value={editingStudent.phone}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">تليفون الوالد / ولي الأمر</label>
                <input
                  type="tel"
                  required
                  value={editingStudent.parentPhone}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الصف الأكاديمي</label>
                <select
                  value={editingStudent.grade}
                  onChange={(e) => setEditingStudent({ ...editingStudent, grade: e.target.value as GradeType })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-sm text-right"
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
                <label className="block text-xs font-bold text-gray-600 mb-1">المجموعة</label>
                <select
                  value={editingStudent.groupId}
                  onChange={(e) => setEditingStudent({ ...editingStudent, groupId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-sm text-right"
                >
                  <option value="">اختر المجموعة...</option>
                  {groups
                    .filter(g => g.grade === editingStudent.grade)
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المدرسة</label>
                <input
                  type="text"
                  value={editingStudent.school}
                  onChange={(e) => setEditingStudent({ ...editingStudent, school: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">العنوان بالتفصيل</label>
                <input
                  type="text"
                  value={editingStudent.address}
                  onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">حالة الإعفاء المالي</label>
                <select
                  value={editingStudent.exemptionType}
                  onChange={(e) => {
                    const exemptionType = e.target.value as ExemptionType;
                    setEditingStudent({ 
                      ...editingStudent, 
                      exemptionType,
                      discountAmount: exemptionType !== 'partial' ? 0 : editingStudent.discountAmount 
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-sm text-right"
                >
                  <option value="none">اشتراك عادي كامل</option>
                  <option value="partial">خصم أو تخفيض جزئي مستمر</option>
                  <option value="full">إعفاء كاف من المستحقات</option>
                </select>
              </div>

              {editingStudent.exemptionType === 'partial' && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">قيمة الخصم المالي (جنيه)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingStudent.discountAmount}
                    onChange={(e) => setEditingStudent({ ...editingStudent, discountAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-sm text-right font-mono"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">ملاحظات إضافية</label>
                <textarea
                  value={editingStudent.notes || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-sm text-right"
                  rows={2}
                />
              </div>

              <div className="md:col-span-2 pt-4">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-sm transition"
                >
                  حفظ وتحديث بيانات السجل الفورية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR SMART CARD VISUAL MODAL */}
      {selectedStudentForCard && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-150 no-print">
            <button 
              onClick={() => setSelectedStudentForCard(null)}
              className="absolute left-4 top-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-xs bg-sky-50 text-sky-700 px-3 py-1 rounded-full font-bold">هوية الطالب الرقمية</span>
              <h3 className="text-xl font-extrabold text-slate-800 mt-2 font-sans">بطاقة العضوية الذكية QR</h3>
              <p className="text-xs text-gray-400 mt-1">تستخدم لمسح الحضور الفوري والغياب وتتبع الحسابات في السنتر.</p>
            </div>

            {/* CARD TARGETING EMBED FOR PRINT */}
            <div 
              id="student-id-card"
              className="bg-radial from-sky-50 to-white print-card p-6 rounded-3xl border-2 border-sky-450 text-right relative shadow-xl overflow-hidden max-w-[340px] mx-auto space-y-4"
            >
              {/* Header */}
              <div className="border-b-2 border-dashed border-sky-200 pb-3 flex justify-between items-center bg-sky-600/5 -mx-6 -mt-6 p-4">
                <div>
                  <h4 className="font-extrabold text-[#0369a1] text-sm tracking-tight">إدارة مجموعات مادة العلوم</h4>
                  <p className="text-[10px] text-gray-500 font-bold mt-0.5">الأستاذ محمود أبوذكري</p>
                </div>
                <div className="bg-sky-600 text-white px-2 py-0.5 rounded-full text-[9px] font-mono font-bold">
                  {selectedStudentForCard.code}
                </div>
              </div>

              {/* Student info */}
              <div className="space-y-2 pt-2">
                <div>
                  <div className="text-[10px] text-gray-404 font-bold">اسم الطالب:</div>
                  <div className="font-bold text-gray-800 text-base leading-tight">{selectedStudentForCard.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <div className="text-[9px] text-gray-404 font-bold">الصف الملحق به:</div>
                    <div className="text-xs font-semibold text-slate-700 leading-tight">{selectedStudentForCard.grade}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-404 font-bold">اسم المجموعة:</div>
                    <div className="text-xs font-bold text-sky-700 leading-tight">
                      {groups.find(g => g.id === selectedStudentForCard.groupId)?.name || 'غير مخصص'}
                    </div>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center gap-1">
                  <div>
                    <div className="text-[8px] text-gray-404 font-bold">موبايل ولي الأمر:</div>
                    <div className="text-[11.5px] font-mono font-semibold text-slate-800 tracking-wider">
                      {selectedStudentForCard.parentPhone}
                    </div>
                  </div>
                  <div className="text-[8px] text-gray-404 text-left leading-relaxed">
                    منطقة السنتر<br/>
                    <span className="font-medium text-slate-600">{selectedStudentForCard.address || 'أسيوط'}</span>
                  </div>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="bg-white p-3.5 rounded-2xl border border-sky-100 shadow-inner flex items-center justify-center">
                <div className="relative">
                  <QRCodeSVG 
                    value={selectedStudentForCard.id} 
                    size={110}
                    bgColor={"#FFFFFF"}
                    fgColor={"#0369a1"}
                    level={"H"}
                    includeMargin={false}
                  />
                  <div className="absolute top-[40%] left-[40%] bg-white w-5 h-5 rounded-md flex items-center justify-center shadow-xs">
                    <span className="text-[7px] font-extrabold text-sky-700">Abz</span>
                  </div>
                </div>
              </div>

              <div className="text-[8.5px] text-gray-400 text-center italic-none uppercase font-mono tracking-widest pt-1 border-t border-dashed">
                * يرجى إبراز الكارت عند بوابة السنتر لتسجيل الدخول *
              </div>
            </div>

            {/* Print Action button */}
            <div className="pt-4 flex justify-between gap-3">
              <button
                onClick={() => {
                  window.dispatchEvent(new Event('beforeprint'));
                  setTimeout(() => {
                    const printContents = document.getElementById('student-id-card')?.outerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      document.body.innerHTML = `
                        <div class="print-only flex items-center justify-center min-h-screen bg-white" style="direction: rtl !important;">
                          ${printContents}
                        </div>
                      `;
                      window.print();
                      window.location.reload(); // Refresh to restore App react bindings!
                    }
                  }, 100);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                طباعة الكارت QR المزدوج
              </button>
              <button
                onClick={() => setSelectedStudentForCard(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold transition hover:bg-gray-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH PRINT MODAL (A4 MULTI-CARD) */}
      {showBatchPrintModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-150 no-print text-right">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowBatchPrintModal(false)}
              className="absolute left-6 top-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title Block */}
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">كرّاسة الطباعة الجماعية للطلاب</span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2 font-sans">طباعة كروت الحضور الملونة على ورق A4</h3>
              <p className="text-xs text-slate-500 mt-1">توليد وتنسيق الكروت الذكية آلياً على صفحات A4 لتسهيل عملية القص والتوزيع على الطلاب في السنتر.</p>
            </div>

            {/* Top Toolbar: Grade filter, Group filter, Search inside batch list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">بحث سريع بالاسم أو الكود</label>
                <input
                  type="text"
                  placeholder="ابحث بالاسم، الكود، الهاتف..."
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none text-right placeholder:text-slate-400 font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 font-sans">تصفية حسب الصف الدراسي</label>
                <select
                  value={batchFilterGrade}
                  onChange={(e) => {
                    setBatchFilterGrade(e.target.value);
                    setBatchFilterGroup('all');
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none text-right font-sans"
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

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">تصفية حسب المجموعة</label>
                <select
                  value={batchFilterGroup}
                  onChange={(e) => setBatchFilterGroup(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none text-right font-sans"
                >
                  <option value="all">كل المجموعات</option>
                  {groups
                    .filter(g => batchFilterGrade === 'all' || g.grade === batchFilterGrade)
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.grade})</option>
                    ))
                  }
                </select>
              </div>
            </div>

            {/* Selection Quick Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllBatch}
                  className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 transition cursor-pointer"
                >
                  تحديد الكل المعروض ({batchFilteredStudents.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllBatch}
                  className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                >
                  إلغاء تحديد الكل
                </button>
                <div className="hidden sm:block h-4 w-[1px] bg-slate-200 self-center mx-1"></div>
                <button
                  type="button"
                  onClick={() => handleLimitBatch(8)}
                  className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  أول 8 كروت (صفحة 1)
                </button>
                <button
                  type="button"
                  onClick={() => handleLimitBatch(16)}
                  className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  أول 16 كرت (صفحتين)
                </button>
                <button
                  type="button"
                  onClick={() => handleLimitBatch(24)}
                  className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition cursor-pointer"
                >
                  أول 24 كرت (3 صفحات)
                </button>
              </div>

              {/* Show Cut Guidelines toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cut-borders-checkbox"
                  checked={cutBorders}
                  onChange={(e) => setCutBorders(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <label htmlFor="cut-borders-checkbox" className="text-xs font-bold text-slate-750 select-none cursor-pointer">
                  رسم خطوط إرشادية منقطة لسهولة القص بالمقص
                </label>
              </div>
            </div>

            {/* Scrollable Students List with Checkboxes */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto bg-slate-50/20">
              {batchFilteredStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-bold font-sans">
                  لا يوجد طلاب مناسبين للطباعة وفق خيارات التصفية المدخلة حالياً.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {batchFilteredStudents.map(student => {
                    const isSelected = selectedForBatch.includes(student.id);
                    const group = groups.find(g => g.id === student.groupId);
                    return (
                      <div 
                        key={student.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedForBatch(prev => prev.filter(id => id !== student.id));
                          } else {
                            setSelectedForBatch(prev => [...prev, student.id]);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between text-right ${
                          isSelected 
                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-1 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 accent-indigo-600 flex-shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{student.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">{student.code} — {student.grade}</div>
                            <div className="text-[10px] text-indigo-700 font-bold truncate mt-0.5">{group?.name || 'مجموعة غير محددة'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Print Settings Guidance */}
            <div className="bg-amber-50/70 border border-amber-200/50 rounded-2xl p-4 text-right space-y-1.5 text-[11px] text-amber-900 leading-relaxed font-sans shadow-inner">
              <div className="font-extrabold flex items-center gap-1.5 mb-1 text-slate-850">
                <span>⚡ إعدادات بالغة الأهمية قبل الضغط على طباعة:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 font-medium text-slate-700 pl-2">
                <li>يرجى تعيين اتجاه الصفحة داخل لوحة خيارات المتصفح على <span className="font-bold text-slate-900">رأسي (Portrait)</span>.</li>
                <li>تأكد من اختيار حجم الورق على القياس <span className="font-extrabold text-slate-900">A4</span> القياسي.</li>
                <li>اضبط الهوامش في المتصفح (Margins) على خيار <span className="font-bold text-slate-900">بلا هوامش (None)</span> أو <span className="font-bold text-slate-900">أصغر ما يمكن (Minimal)</span> لإلغاء أي خطوط هامشية مشوهة.</li>
                <li>فعّل بالضرورة خيار <span className="font-bold text-slate-900">طباعة رسومات الخلفية (Background Graphics)</span> لضمان إبراز الديكورات والألوان الزرقاء الأنيقة للكروت.</li>
              </ul>
            </div>

            {/* Status indicators & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center border-t border-slate-100 pt-5 gap-4">
              <div className="text-right text-xs">
                <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg inline-block border border-slate-200">
                  إجمالي المختار للطباعة: <strong className="text-indigo-700 font-mono text-sm">{selectedForBatch.length}</strong> كارت عضوية
                </span>
                {selectedForBatch.length > 0 && (
                  <span className="text-slate-500 font-semibold mr-3 font-sans">
                    (سيشغل <strong className="text-slate-800 font-bold">{Math.ceil(selectedForBatch.length / 8)}</strong> ورقة A4 بمعدل 8 كرت/ورقة)
                  </span>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowBatchPrintModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-205 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-250/30"
                >
                  إغلاق وتراجع
                </button>
                <button
                  type="button"
                  disabled={selectedForBatch.length === 0}
                  onClick={handlePrintBatchA4}
                  className="flex-1 sm:flex-initial px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg shadow-indigo-600/10"
                >
                  <Download className="w-4 h-4" />
                  <span id="pdf-btn-text">تصدير وتحميل الكروت كصور (JPG)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN IN SCREEN VIEW - FOR RAW PRINT PREPARATION */}
      <div id="batch-print-layout-raw" style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '210mm', backgroundColor: '#ffffff', zIndex: -1000, pointerEvents: 'none' }}>
          {printPages.map((pageStudents, pageIdx) => (
            <div 
              key={pageIdx} 
              className="a4-print-page"
            >
              {/* Top tiny label helper */}
              <div className="flex justify-between items-center text-[9px] text-slate-400 border-b border-slate-100 pb-1 mb-4 select-none">
                <span className="font-bold">نظام الأستاذ محمود أبوذكري لإدارة مادة العلوم - كروت الحضور والغياب الذكية</span>
                <span className="font-bold font-mono">صفحة {pageIdx + 1} من {printPages.length}</span>
              </div>

              {/* Grid 2x4 Layout */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 justify-center items-start">
                {pageStudents.map(student => {
                  const group = groups.find(g => g.id === student.groupId);
                  const groupName = group ? group.name : 'غير مخصص';
                  return (
                    <div 
                      key={student.id}
                      className={`p-3 bg-white text-right flex flex-row items-center justify-between relative overflow-hidden ${
                        cutBorders 
                          ? 'border-2 border-dashed border-slate-300' 
                          : 'border border-slate-100 shadow-sm'
                      }`}
                      style={{ 
                        width: '92mm', 
                        height: '62mm', 
                        boxSizing: 'border-box',
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                        borderRadius: '16px'
                      }}
                    >
                      {/* Background decor watermark specifically for printed sheet */}
                      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-sky-600/5 rounded-full select-none pointer-events-none"></div>

                      {/* Left side: QR code column (35% width approx) */}
                      <div 
                        className="flex flex-col items-center justify-center h-full pl-2 select-none border-l border-dashed border-slate-200"
                        style={{ width: '31mm', boxSizing: 'border-box' }}
                      >
                        <div className="bg-white p-1.5 rounded-xl border border-slate-150 flex items-center justify-center shadow-xs">
                          <QRCodeSVG 
                            value={student.id} 
                            size={70}
                            bgColor={"#FFFFFF"}
                            fgColor={"#0369a1"}
                            level={"H"}
                            includeMargin={false}
                          />
                        </div>
                        <div className="text-[8px] font-mono font-black text-sky-800 tracking-wider mt-1 px-2 py-0.5 bg-sky-50 text-sky-800 rounded">
                          {student.code}
                        </div>
                      </div>

                      {/* Right side: Student detail labels and info (65% width approx) */}
                      <div 
                        className="flex-1 pr-3 flex flex-col justify-between h-full text-right"
                        style={{ width: '51mm', boxSizing: 'border-box' }}
                      >
                        {/* Brand and Logo Header of Center */}
                        <div>
                          <div className="flex items-center gap-1 justify-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse"></span>
                            <span className="text-[8.5px] font-extrabold text-sky-700 tracking-tight">مجموعات العلوم المتكاملة</span>
                          </div>
                          <div className="text-[7.5px] text-slate-400 font-bold -mt-0.5">الأستاذ محمود أبوذكري</div>
                        </div>

                        {/* Student full name */}
                        <div className="py-1">
                          <div className="text-[7.5px] text-slate-400 font-bold leading-none">اسم الطالب المنتسب:</div>
                          <div className="text-[11.5px] font-black text-slate-850 leading-tight mt-0.5 truncate max-w-[170px]" title={student.name}>
                            {student.name}
                          </div>
                        </div>

                        {/* Detail metadata list */}
                        <div className="space-y-0.5">
                          <div className="text-[8px] text-slate-500 leading-none">
                            <span className="font-bold text-slate-400">الصف الدراسي:</span> <span className="font-bold text-slate-700">{student.grade}</span>
                          </div>
                          <div className="text-[8px] text-slate-550 leading-none truncate max-w-[170px]">
                            <span className="font-bold text-slate-400">المجموعة:</span> <span className="font-bold text-slate-750">{groupName}</span>
                          </div>
                          <div className="text-[8px] text-slate-500 leading-none">
                            <span className="font-bold text-slate-400">موبايل الوالد:</span> <span className="font-mono font-bold text-slate-800">{student.parentPhone}</span>
                          </div>
                        </div>

                        {/* Warning line at card bottom */}
                        <div className="border-t border-slate-100 pt-1 text-[7px] text-slate-400 text-center font-bold font-sans">
                          يرجى إبراز الكارت عند الحضور والمغادرة
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
              
            </div>
          ))}
      </div>

      {/* DELETE STUDENT CONFIRMATION MODAL */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-right space-y-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 text-red-600">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                تأكيد حذف بيانات الطالب
              </h3>
            </div>

            {/* Modal Content */}
            <div className="text-xs text-slate-600 leading-relaxed font-semibold space-y-2">
              <p className="text-slate-800 text-sm font-bold">
                هل أنت متأكد تماماً من رغبتك في حذف الطالب <span className="text-red-650">"{deletingStudent.name}"</span> نهائياً؟
              </p>
              <p className="text-slate-400 font-medium leading-relaxed">
                سيؤدي هذا الإجراء إلى إزالة الطالب وسجل غيابه وحضوره ودرجاته بالكامل من السنتر بشكل نهائي. لا يمكن التراجع عن هذا الإجراء أو استعادة البيانات بعد الحذف.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={confirmDeleteStudent}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition text-xs cursor-pointer text-center"
              >
                نعم، احذف الطالب نهائياً
              </button>
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg font-bold transition text-xs cursor-pointer text-center"
              >
                إلغاء الأمر
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ERROR MESSAGE POPUP */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-100 border border-slate-200">
            <button 
              onClick={() => setErrorMessage(null)}
              className="absolute left-4 top-4 p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 bg-red-50 text-red-800 border border-red-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">
                تنبيه من السجل
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed font-semibold">
                {errorMessage}
              </p>
            </div>

            <button
              onClick={() => setErrorMessage(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-lg text-xs transition cursor-pointer"
            >
              مفهوم ومتابعة
            </button>
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
    </div>
  );
}
