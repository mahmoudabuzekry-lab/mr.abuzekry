/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { dbEngine } from '../db';
import { Student, Group, GradeType, ExemptionType, RegistrationSettings } from '../types';
import { 
  UserPlus, Search, Filter, Check, X, QrCode, Trash2, Edit, Printer, 
  Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, Save, ShieldAlert,
  MessageSquare, Sparkles, Send, Info, Lock, Unlock, Globe, Sliders
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { toJpeg } from 'html-to-image';

export type CardThemeType = 'navy-red' | 'blue-solid' | 'red-solid' | 'black-solid' | 'blue-red' | 'black-red';
export type CardFontSizeType = 'normal' | 'medium' | 'large' | 'xlarge';

export const themeConfig = {
  'navy-red': {
    primary: '#1e3a8a',
    accent: '#dc2626',
    cardBorder: 'border-blue-900',
    headerBg: 'bg-blue-50',
    badgeBg: 'bg-blue-900 border-blue-850',
    badgeText: 'text-white',
    labelColor: 'text-blue-900',
    valColor: 'text-black',
    phoneColor: 'text-red-600',
    footerText: 'text-red-600',
    footerBorder: 'border-red-200',
    qrBorder: 'border-blue-900',
    tagColor: 'text-blue-900',
    dotBg: 'bg-blue-600',
    textMain: 'text-blue-800',
  },
  'blue-solid': {
    primary: '#1d4ed8',
    accent: '#1e40af',
    cardBorder: 'border-blue-700',
    headerBg: 'bg-blue-50/50',
    badgeBg: 'bg-blue-700 border-blue-650',
    badgeText: 'text-white',
    labelColor: 'text-blue-800',
    valColor: 'text-black',
    phoneColor: 'text-blue-700',
    footerText: 'text-blue-700',
    footerBorder: 'border-blue-200',
    qrBorder: 'border-blue-700',
    tagColor: 'text-blue-800',
    dotBg: 'bg-blue-600',
    textMain: 'text-blue-700',
  },
  'red-solid': {
    primary: '#b91c1c',
    accent: '#991b1b',
    cardBorder: 'border-red-700',
    headerBg: 'bg-red-50/50',
    badgeBg: 'bg-red-700 border-red-650',
    badgeText: 'text-white',
    labelColor: 'text-red-800',
    valColor: 'text-black',
    phoneColor: 'text-red-700',
    footerText: 'text-red-700',
    footerBorder: 'border-red-200',
    qrBorder: 'border-red-700',
    tagColor: 'text-red-800',
    dotBg: 'bg-red-600',
    textMain: 'text-red-750',
  },
  'black-solid': {
    primary: '#000000',
    accent: '#1f2937',
    cardBorder: 'border-black border-4',
    headerBg: 'bg-slate-100',
    badgeBg: 'bg-black border-slate-850',
    badgeText: 'text-white',
    labelColor: 'text-slate-900',
    valColor: 'text-black',
    phoneColor: 'text-black',
    footerText: 'text-black',
    footerBorder: 'border-slate-300',
    qrBorder: 'border-black',
    tagColor: 'text-black',
    dotBg: 'bg-black',
    textMain: 'text-black',
  },
  'blue-red': {
    primary: '#2563eb',
    accent: '#dc2626',
    cardBorder: 'border-blue-600',
    headerBg: 'bg-blue-50/50',
    badgeBg: 'bg-blue-600 border-blue-550',
    badgeText: 'text-white',
    labelColor: 'text-blue-800',
    valColor: 'text-black',
    phoneColor: 'text-red-600',
    footerText: 'text-red-600',
    footerBorder: 'border-red-200',
    qrBorder: 'border-blue-600',
    tagColor: 'text-blue-700',
    dotBg: 'bg-blue-500',
    textMain: 'text-blue-800',
  },
  'black-red': {
    primary: '#000000',
    accent: '#dc2626',
    cardBorder: 'border-black',
    headerBg: 'bg-slate-100',
    badgeBg: 'bg-black border-slate-900',
    badgeText: 'text-white',
    labelColor: 'text-slate-900',
    valColor: 'text-black',
    phoneColor: 'text-red-600',
    footerText: 'text-red-600',
    footerBorder: 'border-red-200',
    qrBorder: 'border-black',
    tagColor: 'text-black',
    dotBg: 'bg-red-600',
    textMain: 'text-black',
  },
};

export const fontSizeConfig = {
  'normal': {
    brandTitle: 'text-[9.5px]',
    teacherName: 'text-[8.5px]',
    studentNameLabel: 'text-[8.5px]',
    studentNameVal: 'text-[12px]',
    detailsLabel: 'text-[8.5px]',
    detailsText: 'text-[9.5px]',
    footerText: 'text-[8px]',
    codeText: 'text-[10px]',
    phoneText: 'text-[10.5px]',
  },
  'medium': {
    brandTitle: 'text-[10.5px]',
    teacherName: 'text-[9.5px]',
    studentNameLabel: 'text-[9px]',
    studentNameVal: 'text-[13px]',
    detailsLabel: 'text-[9px]',
    detailsText: 'text-[10px]',
    footerText: 'text-[8.5px]',
    codeText: 'text-[11px]',
    phoneText: 'text-[11.5px]',
  },
  'large': {
    brandTitle: 'text-[11.5px]',
    teacherName: 'text-[10px]',
    studentNameLabel: 'text-[9.5px]',
    studentNameVal: 'text-[14px]',
    detailsLabel: 'text-[9.5px]',
    detailsText: 'text-[10.5px]',
    footerText: 'text-[9px]',
    codeText: 'text-[11.5px]',
    phoneText: 'text-[12.5px]',
  },
  'xlarge': {
    brandTitle: 'text-[13px]',
    teacherName: 'text-[11.5px]',
    studentNameLabel: 'text-[10.5px]',
    studentNameVal: 'text-[15.5px]',
    detailsLabel: 'text-[10.5px]',
    detailsText: 'text-[11.5px]',
    footerText: 'text-[10px]',
    codeText: 'text-[12.5px]',
    phoneText: 'text-[13.5px]',
  },
};

interface StudentManagerProps {
  students: Student[];
  groups: Group[];
  prices: Record<GradeType, number>;
  onRefresh: () => void;
}

export default function StudentManager({ students, groups, prices, onRefresh }: StudentManagerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'new-student' | 'import'>('all');
  const [regSettings, setRegSettings] = useState<RegistrationSettings>(() => dbEngine.getRegistrationSettings());
  
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

  // Card customization state
  const [cardTitle, setCardTitle] = useState('مجموعات العلوم المتكاملة');
  const [cardTeacher, setCardTeacher] = useState('الأستاذ محمود أبوذكري');
  const [cardFooter, setCardFooter] = useState('يرجى إبراز الكارت عند الحضور والمغادرة');
  const [cardTheme, setCardTheme] = useState<CardThemeType>('navy-red');
  const [cardFontSize, setCardFontSize] = useState<CardFontSizeType>('large');
  const [cardShowPhone, setCardShowPhone] = useState(true);
  const [cardShowAddress, setCardShowAddress] = useState(true);

  // Form states
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    phone: '',
    parentPhone: '',
    grade: 'الصف الثالث الإعدادي' as GradeType,
    school: '',
    address: '',
    groupId: '',
    alternativeGroupIds: [] as string[],
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
    templateType: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' | 'registration_approved' | 'registration_rejected';
    messageText: string;
  }>({
    isOpen: false,
    student: null,
    templateType: 'attendance',
    messageText: '',
  });

  // Multi-select for bulk operations
  const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);

  // Bulk WhatsApp Modal state
  const [bulkWhatsAppModal, setBulkWhatsAppModal] = useState<{
    isOpen: boolean;
    studentIds: string[];
    currentIndex: number;
    templateType: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' | 'registration_approved' | 'registration_rejected';
    messageText: string;
    sentStatus: Record<string, 'pending' | 'opened'>;
  }>({
    isOpen: false,
    studentIds: [],
    currentIndex: 0,
    templateType: 'registration_approved',
    messageText: '',
    sentStatus: {}
  });

  const formatNotificationTemplate = (
    templateText: string, 
    student: Student,
    rejectionReason?: string
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
      '[الوقت]': timeNow,
      '[الكود]': student.code || '—',
      '[السبب]': rejectionReason || '—'
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      result = result.replaceAll(placeholder, value);
    });

    return result;
  };

  const handleOpenNotificationModal = (student: Student) => {
    // Determine the logical default template type
    let defaultType: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' | 'registration_approved' | 'registration_rejected' = 'attendance';

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

  const handleTemplateTypeChange = (type: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' | 'registration_approved' | 'registration_rejected') => {
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

  const handleOpenRegistrationSuccessModal = (student: Student) => {
    const templates = dbEngine.getTemplates();
    const tpl = templates.find(t => t.type === 'registration_approved') || { text: 'ولي الأمر العزيز، يسعدنا إعلامكم بقبول واعتماد طلب تسجيل الطالب...' };
    const formattedText = formatNotificationTemplate(tpl.text, student);
    setNotificationModal({
      isOpen: true,
      student,
      templateType: 'registration_approved',
      messageText: formattedText
    });
  };

  const handleOpenBulkWhatsAppModal = (
    studentIds: string[], 
    defaultType: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' | 'registration_approved' | 'registration_rejected' = 'registration_approved'
  ) => {
    const initialStatus: Record<string, 'pending' | 'opened'> = {};
    studentIds.forEach(id => {
      initialStatus[id] = 'pending';
    });

    const firstStudent = students.find(s => s.id === studentIds[0]);
    let initialMsg = '';
    if (firstStudent) {
      const templates = dbEngine.getTemplates();
      const tpl = templates.find(t => t.type === defaultType) || { text: '' };
      initialMsg = formatNotificationTemplate(tpl.text, firstStudent);
    }

    setBulkWhatsAppModal({
      isOpen: true,
      studentIds,
      currentIndex: 0,
      templateType: defaultType,
      messageText: initialMsg,
      sentStatus: initialStatus
    });
  };

  const handleBulkTemplateChange = (type: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'announcement' | 'custom' | 'registration_approved' | 'registration_rejected') => {
    const currentStudentId = bulkWhatsAppModal.studentIds[bulkWhatsAppModal.currentIndex];
    const student = students.find(s => s.id === currentStudentId);
    if (student) {
      const templates = dbEngine.getTemplates();
      const tpl = templates.find(t => t.type === type) || { text: '' };
      const text = formatNotificationTemplate(tpl.text, student);
      setBulkWhatsAppModal(prev => ({
        ...prev,
        templateType: type,
        messageText: text
      }));
    }
  };

  const updateBulkMessageTextForIndex = (index: number, templateType: any, ids: string[]) => {
    const currentStudentId = ids[index];
    const student = students.find(s => s.id === currentStudentId);
    if (student) {
      const templates = dbEngine.getTemplates();
      const tpl = templates.find(t => t.type === templateType) || { text: '' };
      return formatNotificationTemplate(tpl.text, student);
    }
    return '';
  };

  const handleSendCurrentBulkWhatsApp = () => {
    const { studentIds, currentIndex, templateType, sentStatus, messageText } = bulkWhatsAppModal;
    const currentStudentId = studentIds[currentIndex];
    const student = students.find(s => s.id === currentStudentId);
    if (!student) return;

    let cleanPhone = student.parentPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) {
      cleanPhone = `20${cleanPhone}`; // Egypt country code
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');

    const updatedStatus = { ...sentStatus, [currentStudentId]: 'opened' as const };
    const nextIndex = currentIndex + 1;

    if (nextIndex < studentIds.length) {
      const nextMsgText = updateBulkMessageTextForIndex(nextIndex, templateType, studentIds);
      setBulkWhatsAppModal(prev => ({
        ...prev,
        currentIndex: nextIndex,
        sentStatus: updatedStatus,
        messageText: nextMsgText
      }));
    } else {
      setBulkWhatsAppModal(prev => ({
        ...prev,
        currentIndex: nextIndex,
        sentStatus: updatedStatus,
        messageText: ''
      }));
    }
  };

  const handleSkipCurrentBulk = () => {
    const { studentIds, currentIndex, templateType } = bulkWhatsAppModal;
    const nextIndex = currentIndex + 1;

    if (nextIndex < studentIds.length) {
      const nextMsgText = updateBulkMessageTextForIndex(nextIndex, templateType, studentIds);
      setBulkWhatsAppModal(prev => ({
        ...prev,
        currentIndex: nextIndex,
        messageText: nextMsgText
      }));
    } else {
      setBulkWhatsAppModal(prev => ({
        ...prev,
        currentIndex: nextIndex,
        messageText: ''
      }));
    }
  };

  const handleSelectBulkQueueIndex = (index: number) => {
    const { studentIds, templateType } = bulkWhatsAppModal;
    if (index >= 0 && index < studentIds.length) {
      const msgText = updateBulkMessageTextForIndex(index, templateType, studentIds);
      setBulkWhatsAppModal(prev => ({
        ...prev,
        currentIndex: index,
        messageText: msgText
      }));
    }
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
      alternativeGroupIds: newStudentForm.alternativeGroupIds || [],
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
      alternativeGroupIds: [],
      exemptionType: 'none',
      discountAmount: 0,
      notes: ''
    });
    
    onRefresh();
    setActiveTab('all');
  };

  // State for Approval Modal
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    sendWhatsApp: boolean;
    messageText: string;
  }>({
    isOpen: false,
    student: null,
    sendWhatsApp: true,
    messageText: '',
  });

  // State for Rejection Modal
  const [rejectionModal, setRejectionModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    reason: string;
    sendWhatsApp: boolean;
    messageText: string;
  }>({
    isOpen: false,
    student: null,
    reason: 'عدم اكتمال البيانات الأساسية المطلوبة',
    sendWhatsApp: true,
    messageText: '',
  });

  // Handle approval of requests
  const handleApprove = (student: Student) => {
    const templates = dbEngine.getTemplates();
    const tpl = templates.find(t => t.type === 'registration_approved') || { text: 'تم قبول طلب تسجيل الطالب *[اسم_الطالب]* كود *[الكود]*' };
    const text = formatNotificationTemplate(tpl.text, student);
    setApprovalModal({
      isOpen: true,
      student,
      sendWhatsApp: true,
      messageText: text,
    });
  };

  const handleReject = (student: Student) => {
    const defaultReason = 'عدم اكتمال البيانات الأساسية المطلوبة';
    const templates = dbEngine.getTemplates();
    const tpl = templates.find(t => t.type === 'registration_rejected') || { text: 'نعتذر عن عدم قبول طلب تسجيل الطالب *[اسم_الطالب]* بسبب *[السبب]*' };
    const text = formatNotificationTemplate(tpl.text, student, defaultReason);
    setRejectionModal({
      isOpen: true,
      student,
      reason: defaultReason,
      sendWhatsApp: true,
      messageText: text,
    });
  };

  const handleRejectionReasonChange = (newReason: string) => {
    if (!rejectionModal.student) return;
    const templates = dbEngine.getTemplates();
    const tpl = templates.find(t => t.type === 'registration_rejected') || { text: 'نعتذر عن عدم قبول طلب تسجيل الطالب *[اسم_الطالب]* بسبب *[السبب]*' };
    const text = formatNotificationTemplate(tpl.text, rejectionModal.student, newReason === 'custom_reason' ? '' : newReason);
    setRejectionModal(prev => ({
      ...prev,
      reason: newReason,
      messageText: text,
    }));
  };

  const confirmApprove = () => {
    if (!approvalModal.student) return;
    const s = approvalModal.student;
    
    dbEngine.updateStudentStatus(s.id, 'approved');
    
    if (approvalModal.sendWhatsApp && approvalModal.messageText.trim()) {
      let cleanPhone = s.parentPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('01')) {
        cleanPhone = `20${cleanPhone}`;
      }
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(approvalModal.messageText)}`;
      window.open(waUrl, '_blank');
    }
    
    setApprovalModal({ isOpen: false, student: null, sendWhatsApp: true, messageText: '' });
    onRefresh();
  };

  const confirmReject = () => {
    if (!rejectionModal.student) return;
    const s = rejectionModal.student;
    
    dbEngine.updateStudentStatus(s.id, 'rejected');
    
    if (rejectionModal.sendWhatsApp && rejectionModal.messageText.trim()) {
      let cleanPhone = s.parentPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('01')) {
        cleanPhone = `20${cleanPhone}`;
      }
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rejectionModal.messageText)}`;
      window.open(waUrl, '_blank');
    }
    
    setRejectionModal({ isOpen: false, student: null, reason: 'عدم اكتمال البيانات الأساسية المطلوبة', sendWhatsApp: true, messageText: '' });
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

    // Disable button or update text while exporting
    const exportButtonText = document.getElementById('pdf-btn-text');
    const originalText = exportButtonText ? exportButtonText.innerText : 'تصدير وتحميل الكروت كصور (JPG)';
    if (exportButtonText) {
      exportButtonText.innerText = 'جاري توليد وتصدير الصور (JPG)...';
    }

    // Keep track of original style
    const originalStyle = rawElement.getAttribute('style') || '';

    // Temporarily position it within the viewport underneath everything (so html-to-image can measure & render perfectly)
    rawElement.setAttribute('style', 'position: fixed; left: 0; top: 0; width: 794px; background-color: #ffffff; z-index: -9999; opacity: 1; pointer-events: none;');

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

      // Render the page element to a high-quality JPEG using html-to-image for flawless Arabic text rendering
      toJpeg(pageEl, {
        quality: 0.98,
        pixelRatio: 3, // 3x pixel density for super crisp text and QR codes
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '794px',
          height: '1123px'
        }
      }).then((dataUrl: string) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `كروت_الطلاب_صفحة_${currentIndex + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Advance to next page with a small timeout to let the UI thread breathe
        currentIndex++;
        setTimeout(exportNextPage, 300);
      }).catch((err: any) => {
        console.error('Error generating image page with html-to-image:', err);
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
                  <th className="py-3 px-4 font-semibold w-10">
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedForBulk.includes(s.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = filteredStudents.map(s => s.id);
                          setSelectedForBulk(allIds);
                        } else {
                          setSelectedForBulk([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer accent-indigo-650"
                    />
                  </th>
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
                    <td colSpan={8} className="text-center py-10 text-slate-405">
                      لا يوجد متعلمين يطابقون خيارات التصفية المدخلة.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const group = groups.find(g => g.id === s.groupId);
                    const isSelected = selectedForBulk.includes(s.id);
                    return (
                      <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                        <td className="py-3.5 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedForBulk(prev => [...prev, s.id]);
                              } else {
                                setSelectedForBulk(prev => prev.filter(id => id !== s.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-650 focus:ring-indigo-500 border-slate-300 cursor-pointer accent-indigo-650"
                          />
                        </td>
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
                            onClick={() => handleOpenRegistrationSuccessModal(s)}
                            title="إرسال إشعار نجاح التسجيل لولي الأمر (WhatsApp)"
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg inline-flex items-center transition-all border border-emerald-100 cursor-pointer"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-650" />
                          </button>
                          <button
                            onClick={() => handleOpenNotificationModal(s)}
                            title="إرسال إشعار WhatsApp ذكي"
                            className="p-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg inline-flex items-center transition-all border border-slate-200 cursor-pointer"
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
                            className="p-1.5 bg-red-50 text-red-655 hover:bg-red-100 rounded-lg inline-flex items-center transition-all border border-red-100 cursor-pointer"
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
          <div className="space-y-6">
            {/* Control Panel Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1 text-right">
                  <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-600" />
                    التحكم في استمارة التسجيل الذاتي للطلاب
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    تتيح لك هذه الإعدادات تمكين أو إغلاق الاستمارة الإلكترونية العامة أو تخصيص الإتاحة لصفوف معينة.
                  </p>
                </div>
                
                {/* Global Toggle switch */}
                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 justify-between sm:justify-start">
                  <span className="text-xs font-black text-slate-700">حالة الاستمارة كلياً:</span>
                  <button
                    onClick={() => {
                      const updated = {
                        ...regSettings,
                        isGloballyEnabled: !regSettings.isGloballyEnabled
                      };
                      setRegSettings(updated);
                      dbEngine.setRegistrationSettings(updated);
                      onRefresh();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      regSettings.isGloballyEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        regSettings.isGloballyEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-bold ${regSettings.isGloballyEnabled ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {regSettings.isGloballyEnabled ? 'متاحة للجميع' : 'مغلقة كلياً'}
                  </span>
                </div>
              </div>

              {regSettings.isGloballyEnabled && (
                <div className="space-y-4 animate-in fade-in duration-200 text-right">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <Globe className="w-4 h-4 text-indigo-500" />
                    <span>تخصيص الإتاحة حسب الصف الدراسي:</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {([
                      'الصف الرابع الابتدائي',
                      'الصف الخامس الابتدائي',
                      'الصف السادس الابتدائي',
                      'الصف الأول الإعدادي',
                      'الصف الثاني الإعدادي',
                      'الصف الثالث الإعدادي'
                    ] as GradeType[]).map((grade) => {
                      const isDisabled = regSettings.disabledGrades?.includes(grade);
                      return (
                        <div
                          key={grade}
                          onClick={() => {
                            const newDisabled = isDisabled
                              ? regSettings.disabledGrades.filter(g => g !== grade)
                              : [...(regSettings.disabledGrades || []), grade];
                            const updated = {
                              ...regSettings,
                              disabledGrades: newDisabled
                            };
                            setRegSettings(updated);
                            dbEngine.setRegistrationSettings(updated);
                            onRefresh();
                          }}
                          className={`p-3.5 rounded-xl border-2 text-right transition-all cursor-pointer flex items-center justify-between select-none ${
                            isDisabled
                              ? 'border-rose-100 bg-rose-50/30 text-rose-950 hover:bg-rose-50/50'
                              : 'border-slate-100 bg-slate-50/30 text-slate-850 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-xs font-bold">{grade}</span>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-extrabold flex items-center gap-1 shrink-0 ${
                            isDisabled ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isDisabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            {isDisabled ? 'مغلق' : 'متاح'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

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
                              onClick={() => handleApprove(s)}
                              className="px-3.5 py-1.5 bg-emerald-600 label-shadow text-white hover:bg-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              قبول واعتماد
                            </button>
                            <button
                              onClick={() => handleReject(s)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
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
                    const gradeGroups = groups.filter(g => g.grade === grade);
                    setNewStudentForm({ 
                      ...newStudentForm, 
                      grade,
                      groupId: gradeGroups.length > 0 ? gradeGroups[0].id : '',
                      alternativeGroupIds: []
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
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setNewStudentForm({
                      ...newStudentForm,
                      groupId: selectedId,
                      alternativeGroupIds: (newStudentForm.alternativeGroupIds || []).filter(id => id !== selectedId)
                    });
                  }}
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

              {/* Alternative Groups (Flexible Days) */}
              <div className="md:col-span-2 bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-2 text-right font-sans">
                <label className="block text-xs font-bold text-blue-900">مجموعات حضور بديلة / إضافية (أيام مرنة للتحضير)</label>
                <p className="text-[10px] text-blue-600 leading-relaxed">
                  يمكن للمتعلم الحضور في هذه المجموعات كبديل أو كإضافة لمجموعته الأساسية (المستهدفة) لنفس الصف المقيد عليه. سيتم عرضه في كشوف رصد الحضور والغياب لهذه الأيام تلقائياً.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {groups
                    .filter(g => g.grade === newStudentForm.grade && g.id !== newStudentForm.groupId)
                    .map(g => {
                      const isChecked = newStudentForm.alternativeGroupIds?.includes(g.id);
                      return (
                        <label key={g.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50/20 transition-all select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated = checked
                                ? [...(newStudentForm.alternativeGroupIds || []), g.id]
                                : (newStudentForm.alternativeGroupIds || []).filter(id => id !== g.id);
                              setNewStudentForm({ ...newStudentForm, alternativeGroupIds: updated });
                            }}
                            className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                          />
                          <div className="text-right">
                            <div className="text-xs font-bold text-gray-800">{g.name}</div>
                            <div className="text-[10px] text-gray-500">({g.day} : {g.time})</div>
                          </div>
                        </label>
                      );
                    })
                  }
                  {groups.filter(g => g.grade === newStudentForm.grade && g.id !== newStudentForm.groupId).length === 0 && (
                    <div className="text-xs text-gray-400 italic">لا توجد مجموعات أخرى متاحة في هذا الصف لتحديد أيام بديلة.</div>
                  )}
                </div>
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
                      {importPreview.slice(0, 50).map((row: any, index: number) => {
                        const name = row['الاسم بالكامل'] || row['الاسم'] || row['Name'] || '-';
                        const phone = row['رقم الهاتف'] || row['الموبايل'] || row['Phone'] || '-';
                        const parentPhone = row['رقم ولي الأمر'] || row['رقم الوالد'] || row['Parent Phone'] || '-';
                        const grade = row['الصف الدراسي'] || row['الصف'] || row['Grade'] || '-';
                        const school = row['المدرسة'] || row['School'] || '-';
                        const address = row['العنوان'] || row['Address'] || '-';
                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800">{name}</td>
                            <td className="p-3 font-mono">{phone}</td>
                            <td className="p-3 font-mono">{parentPhone}</td>
                            <td className="p-3 text-slate-500">{grade}</td>
                            <td className="p-3 text-slate-500">{school}</td>
                            <td className="p-3 text-slate-500">{address}</td>
                          </tr>
                        );
                      })}
                      {importPreview.length > 50 && (
                        <tr>
                          <td colSpan={6} className="p-3 text-center text-gray-400 bg-slate-50 font-medium">
                            تم عرض أول 50 صفًا فقط من أصل {importPreview.length} صفاً...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-150 text-right">
            {/* Close Button */}
            <button 
              onClick={() => setEditingStudent(null)}
              className="absolute left-6 top-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-xs bg-sky-50 text-sky-700 px-3 py-1 rounded-full font-bold">تعديل بيانات الطالب</span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2 font-sans">تحديث سجل الطالب</h3>
            </div>

            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الاسم بالكامل *</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">كود الطالب</label>
                <input
                  type="text"
                  disabled
                  value={editingStudent.code || ''}
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-right font-mono text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الموبايل الشخصي</label>
                <input
                  type="tel"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">رقم هاتف ولي الأمر *</label>
                <input
                  type="tel"
                  required
                  value={editingStudent.parentPhone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الصف الأكاديمي</label>
                <select
                  value={editingStudent.grade || ''}
                  onChange={(e) => {
                    const grade = e.target.value as GradeType;
                    const gradeGroups = groups.filter(g => g.grade === grade);
                    setEditingStudent({
                      ...editingStudent,
                      grade,
                      groupId: gradeGroups.length > 0 ? gradeGroups[0].id : '',
                      alternativeGroupIds: []
                    });
                  }}
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
                <label className="block text-xs font-bold text-gray-600 mb-1">المجموعة الأساسية *</label>
                <select
                  value={editingStudent.groupId || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setEditingStudent({
                      ...editingStudent,
                      groupId: selectedId,
                      alternativeGroupIds: (editingStudent.alternativeGroupIds || []).filter(id => id !== selectedId)
                    });
                  }}
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

              {/* Alternative Groups checkboxes in editing mode */}
              <div className="md:col-span-2 bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-2 text-right font-sans">
                <label className="block text-xs font-bold text-blue-900">مجموعات حضور بديلة / إضافية (أيام مرنة للتحضير)</label>
                <p className="text-[10px] text-blue-600 leading-relaxed">
                  أيام الحضور البديلة المقترحة في هذا الصف للتحضير المرن.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {groups
                    .filter(g => g.grade === editingStudent.grade && g.id !== editingStudent.groupId)
                    .map(g => {
                      const isChecked = editingStudent.alternativeGroupIds?.includes(g.id);
                      return (
                        <label key={g.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-blue-50/20 transition-all select-none">
                          <input
                            type="checkbox"
                            checked={!!isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated = checked
                                ? [...(editingStudent.alternativeGroupIds || []), g.id]
                                : (editingStudent.alternativeGroupIds || []).filter(id => id !== g.id);
                              setEditingStudent({ ...editingStudent, alternativeGroupIds: updated });
                            }}
                            className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                          />
                          <div className="text-right">
                            <div className="text-xs font-bold text-gray-800">{g.name}</div>
                            <div className="text-[10px] text-gray-500">({g.day} : {g.time})</div>
                          </div>
                        </label>
                      );
                    })
                  }
                  {groups.filter(g => g.grade === editingStudent.grade && g.id !== editingStudent.groupId).length === 0 && (
                    <div className="text-xs text-gray-400 italic font-medium">لا توجد مجموعات حضور بديلة متاحة.</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">المدرسة</label>
                <input
                  type="text"
                  value={editingStudent.school || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, school: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">العنوان بالتفصيل</label>
                <input
                  type="text"
                  value={editingStudent.address || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:bg-white focus:border-sky-500 rounded-xl text-sm text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">حالة الإعفاء المالي</label>
                <select
                  value={editingStudent.exemptionType || 'none'}
                  onChange={(e) => {
                    const exemptionType = e.target.value as ExemptionType;
                    setEditingStudent({ 
                      ...editingStudent, 
                      exemptionType,
                      discountAmount: exemptionType !== 'partial' ? 0 : (editingStudent.discountAmount || 0)
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
                    value={editingStudent.discountAmount || 0}
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative animate-in zoom-in-95 duration-150 no-print text-right">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedStudentForCard(null)}
              className="absolute left-6 top-6 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title Block */}
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">هوية الطالب الرقمية الذكية</span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-2 font-sans">تخصيص وتصميم بطاقة العضوية QR</h3>
              <p className="text-xs text-slate-500 mt-1">قم بتعديل النصوص، اختيار نظام الألوان وتكبير حجم الخطوط لضمان دقة ووضوح الطباعة التامة.</p>
            </div>

            {/* 2-Column workspace for customization + preview */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start" dir="rtl">
              
              {/* Customization controls: 5 cols */}
              <div className="md:col-span-5 bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                <h4 className="text-xs font-black text-slate-800 border-b border-slate-200 pb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  خيارات تصميم الكارت والنصوص
                </h4>
                
                {/* Text Title */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">العنوان الرئيسي للبطاقة</label>
                  <input 
                    type="text" 
                    value={cardTitle} 
                    onChange={(e) => setCardTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none font-bold"
                  />
                </div>

                {/* Teacher name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">اسم المعلم / الجهة</label>
                  <input 
                    type="text" 
                    value={cardTeacher} 
                    onChange={(e) => setCardTeacher(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none font-bold"
                  />
                </div>

                {/* Footer text */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">ملاحظة التذييل الإرشادية</label>
                  <input 
                    type="text" 
                    value={cardFooter} 
                    onChange={(e) => setCardFooter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none font-bold"
                  />
                </div>

                {/* Theme Selector */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5">نظام الألوان للبطاقة</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'navy-red', label: 'كحلي وأحمر' },
                      { id: 'blue-solid', label: 'أزرق ملكي' },
                      { id: 'red-solid', label: 'أحمر ياقوتي' },
                      { id: 'black-solid', label: 'أسود داكن' },
                      { id: 'blue-red', label: 'أزرق وأحمر' },
                      { id: 'black-red', label: 'أسود وأحمر' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCardTheme(item.id as CardThemeType)}
                        className={`px-2 py-2 rounded-xl text-[10px] font-black border text-center transition cursor-pointer ${
                          cardTheme === item.id 
                            ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-200' 
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size Selector */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1.5">حجم خطوط البطاقة (لضمان وضوح الطباعة)</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'normal', label: 'عادي' },
                      { id: 'medium', label: 'متوسط' },
                      { id: 'large', label: 'كبير' },
                      { id: 'xlarge', label: 'ضخم' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCardFontSize(item.id as CardFontSizeType)}
                        className={`py-1.5 rounded-xl text-[10px] font-bold border text-center transition cursor-pointer ${
                          cardFontSize === item.id 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggle Controls */}
                <div className="space-y-2.5 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="show-phone-toggle"
                      checked={cardShowPhone}
                      onChange={(e) => setCardShowPhone(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="show-phone-toggle" className="text-xs font-bold text-slate-700 select-none cursor-pointer">إظهار هاتف ولي الأمر في الكارت</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="show-address-toggle"
                      checked={cardShowAddress}
                      onChange={(e) => setCardShowAddress(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="show-address-toggle" className="text-xs font-bold text-slate-700 select-none cursor-pointer">إظهار العنوان / السنتر في الكارت</label>
                  </div>
                </div>

              </div>

              {/* Preview and Actions: 7 cols */}
              <div className="md:col-span-7 flex flex-col items-center justify-center space-y-5">
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50/70 border border-indigo-150 px-3 py-1 rounded-full">
                  معاينة حية وتفاعلية لتصميم الكارت الفوري
                </span>

                {/* Live Card Preview Box */}
                <div className="border border-slate-200 p-6 bg-slate-50 rounded-2xl w-full flex justify-center shadow-inner select-none">
                  <div 
                    id="student-id-card"
                    className={`bg-white p-5 rounded-3xl border-4 ${themeConfig[cardTheme].cardBorder} text-right relative shadow-lg overflow-hidden w-full max-w-[320px] space-y-3.5`}
                    dir="rtl"
                    style={{ fontFamily: "'Cairo', 'Tahoma', 'Arial', sans-serif" }}
                  >
                    {/* Background decoration */}
                    <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-600/5 rounded-full pointer-events-none"></div>

                    {/* Header */}
                    <div className={`border-b-2 border-dashed ${themeConfig[cardTheme].footerBorder} pb-2.5 flex justify-between items-center ${themeConfig[cardTheme].headerBg} -mx-5 -mt-5 p-3.5`}>
                      <div>
                        <h4 className={`font-black ${themeConfig[cardTheme].textMain} ${fontSizeConfig[cardFontSize].brandTitle} tracking-tight`}>
                          {cardTitle}
                        </h4>
                        <p className={`font-black ${fontSizeConfig[cardFontSize].teacherName} ${themeConfig[cardTheme].footerText} mt-0.5`}>
                          {cardTeacher}
                        </p>
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-full ${fontSizeConfig[cardFontSize].codeText} font-mono font-black border ${themeConfig[cardTheme].badgeBg}`}>
                        {selectedStudentForCard.code}
                      </div>
                    </div>

                    {/* Student info */}
                    <div className="space-y-2.5 pt-1.5">
                      <div>
                        <div className={`${fontSizeConfig[cardFontSize].studentNameLabel} ${themeConfig[cardTheme].labelColor} font-black`}>اسم الطالب المنتسب:</div>
                        <div className={`font-black text-black ${fontSizeConfig[cardFontSize].studentNameVal} leading-tight mt-0.5 truncate max-w-[210px]`} title={selectedStudentForCard.name}>
                          {selectedStudentForCard.name}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <div>
                          <div className={`${fontSizeConfig[cardFontSize].detailsLabel} ${themeConfig[cardTheme].labelColor} font-black`}>الصف الملحق به:</div>
                          <div className={`${fontSizeConfig[cardFontSize].detailsText} font-black text-black leading-tight mt-0.5`}>{selectedStudentForCard.grade}</div>
                        </div>
                        <div>
                          <div className={`${fontSizeConfig[cardFontSize].detailsLabel} ${themeConfig[cardTheme].labelColor} font-black`}>اسم المجموعة:</div>
                          <div className={`${fontSizeConfig[cardFontSize].detailsText} font-black text-black leading-tight mt-0.5 truncate max-w-[100px]`}>
                            {groups.find(g => g.id === selectedStudentForCard.groupId)?.name || 'غير مخصص'}
                          </div>
                        </div>
                      </div>

                      {(cardShowPhone || cardShowAddress) && (
                        <div className={`pt-2 border-t ${themeConfig[cardTheme].footerBorder} flex justify-between items-center gap-1`}>
                          {cardShowPhone ? (
                            <div>
                              <div className={`${fontSizeConfig[cardFontSize].studentNameLabel} ${themeConfig[cardTheme].labelColor} font-black`}>موبايل ولي الأمر:</div>
                              <div className={`${fontSizeConfig[cardFontSize].phoneText} font-mono font-black ${themeConfig[cardTheme].phoneColor} tracking-wider mt-0.5`}>
                                {selectedStudentForCard.parentPhone}
                              </div>
                            </div>
                          ) : <div />}
                          {cardShowAddress ? (
                            <div className="text-[9px] text-slate-500 text-left leading-relaxed">
                              منطقة السنتر<br/>
                              <span className="font-bold text-black">{selectedStudentForCard.address || 'أسيوط'}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* QR Code Container */}
                    <div className={`bg-white p-2.5 rounded-2xl border-2 ${themeConfig[cardTheme].qrBorder} flex items-center justify-center`}>
                      <div className="relative">
                        <QRCodeCanvas 
                          value={selectedStudentForCard.id} 
                          size={300}
                          bgColor={"#FFFFFF"}
                          fgColor={"#000000"}
                          level={"H"}
                          includeMargin={false}
                          style={{ width: '84px', height: '84px' }}
                        />
                        <div className={`absolute top-[40%] left-[40%] bg-white w-5 h-5 rounded-md flex items-center justify-center shadow-xs border ${themeConfig[cardTheme].cardBorder}`}>
                          <span className={`text-[7.5px] font-black ${themeConfig[cardTheme].textMain}`}>Abz</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer text */}
                    <div className={`${fontSizeConfig[cardFontSize].footerText} ${themeConfig[cardTheme].footerText} text-center font-black pt-1 border-t border-dashed ${themeConfig[cardTheme].footerBorder}`}>
                      * {cardFooter} *
                    </div>
                  </div>
                </div>

                {/* Print/Download Actions */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2.5 w-full max-w-[320px]">
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة الكارت
                  </button>
                  <button
                    onClick={() => {
                      const cardEl = document.getElementById('student-id-card');
                      if (!cardEl) return;
                      const btn = document.getElementById('download-single-btn');
                      const originalText = btn ? btn.innerText : '';
                      if (btn) btn.innerText = 'جاري التوليد...';
                      toJpeg(cardEl, {
                        quality: 0.98,
                        pixelRatio: 3.5, // Ultra HD
                        backgroundColor: '#ffffff'
                      })
                      .then((dataUrl) => {
                        const link = document.createElement('a');
                        link.download = `كارت_${selectedStudentForCard.name}.jpg`;
                        link.href = dataUrl;
                        link.click();
                        if (btn) btn.innerText = originalText;
                      })
                      .catch(() => {
                        if (btn) btn.innerText = 'فشل التحميل';
                      });
                    }}
                    id="download-single-btn"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    تحميل كصورة (JPG)
                  </button>
                </div>
              </div>

            </div>

            {/* Modal General footer button */}
            <div className="pt-4 border-t border-slate-150 flex justify-end">
              <button
                onClick={() => setSelectedStudentForCard(null)}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition hover:bg-slate-200 cursor-pointer"
              >
                إغلاق النافذة
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

            {/* DESIGN CUSTOMIZATION FOR BATCH PRINTING */}
            <div className="bg-indigo-50/45 p-4 rounded-2xl border border-indigo-150 space-y-3.5">
              <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5 pb-2 border-b border-indigo-100/60">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                تخصيص وتعديل تصميم ونصوص الكروت الجماعية قبل التصدير والطباعة
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-right">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">عنوان الكارت الرئيسي</label>
                  <input
                    type="text"
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none font-bold"
                  />
                </div>
                {/* Teacher name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">اسم المعلم / الجهة</label>
                  <input
                    type="text"
                    value={cardTeacher}
                    onChange={(e) => setCardTeacher(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none font-bold"
                  />
                </div>
                {/* Footer text */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-1">ملاحظة التذييل الإرشادية</label>
                  <input
                    type="text"
                    value={cardFooter}
                    onChange={(e) => setCardFooter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-xs outline-none font-bold"
                  />
                </div>
                {/* Theme & size options */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1">نظام الألوان</label>
                    <select
                      value={cardTheme}
                      onChange={(e) => setCardTheme(e.target.value as CardThemeType)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-250 rounded-xl text-[11px] font-black outline-none cursor-pointer"
                    >
                      <option value="navy-red">كحلي وأحمر</option>
                      <option value="blue-solid">أزرق ملكي</option>
                      <option value="red-solid">أحمر ياقوتي</option>
                      <option value="black-solid">أسود داكن</option>
                      <option value="blue-red">أزرق وأحمر</option>
                      <option value="black-red">أسود وأحمر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-1">حجم الخط</label>
                    <select
                      value={cardFontSize}
                      onChange={(e) => setCardFontSize(e.target.value as CardFontSizeType)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-250 rounded-xl text-[11px] font-bold outline-none cursor-pointer"
                    >
                      <option value="normal">عادي</option>
                      <option value="medium">متوسط</option>
                      <option value="large">كبير</option>
                      <option value="xlarge">ضخم</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-650 font-black">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cardShowPhone}
                    onChange={(e) => setCardShowPhone(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                  إظهار هاتف ولي الأمر في الكارت
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={cardShowAddress}
                    onChange={(e) => setCardShowAddress(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                  إظهار العنوان / منطقة السنتر
                </label>
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
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer accent-indigo-600 flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-slate-800 truncate" title={student.name}>{student.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold mt-0.5 flex flex-wrap gap-x-2">
                              <span>الصف: {student.grade}</span>
                              <span className="text-slate-300">|</span>
                              <span>المجموعة: {group?.name || 'غير مخصص'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono font-black text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-150 flex-shrink-0">
                          {student.code}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-5 border-t border-slate-150 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs text-slate-500 font-bold font-sans">
                عدد الطلاب المحددين للطباعة حالياً: <span className="text-indigo-600 font-black text-sm">{selectedForBatch.length}</span> طالب
              </div>
              <div className="flex flex-wrap gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handlePrintBatchA4}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span id="pdf-btn-text">تصدير وتحميل كصورة (JPG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedForBatch.length === 0) {
                      setErrorMessage('يرجى تحديد طالب واحد على الأقل للطباعة الجماعية.');
                      return;
                    }
                    window.print();
                  }}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  بدء طباعة الكروت المحددة ({selectedForBatch.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchPrintModal(false)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء وإغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT SHEET WORKSPACE (PORTALED TO BODY FOR FLAWLESS PRINTING) */}
      {createPortal(
        <div 
          id="batch-print-layout-raw"
          className="print-sheets-container bg-white" 
          dir="rtl"
          style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '794px',
            opacity: 0,
            pointerEvents: 'none'
          }}
        >
          {printPages.map((pageStudents, pageIdx) => (
            <div 
              key={pageIdx} 
              className="a4-print-page"
              dir="rtl"
              style={{ fontFamily: "'Cairo', 'Tahoma', 'Arial', sans-serif" }}
            >
              {/* Top tiny label helper */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-200 pb-1.5 mb-4 select-none" dir="rtl">
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
                      className={`p-3 bg-white flex flex-row items-center justify-between relative overflow-hidden ${
                        cutBorders 
                          ? 'border-2 border-dashed border-slate-400' 
                          : `border-4 ${themeConfig[cardTheme].cardBorder}`
                      }`}
                      dir="rtl"
                      style={{ 
                        width: '92mm', 
                        height: '62mm', 
                        boxSizing: 'border-box',
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                        borderRadius: '16px',
                        fontFamily: "'Cairo', 'Tahoma', 'Arial', sans-serif",
                        textAlign: 'right'
                      }}
                    >
                      {/* Background decor watermark specifically for printed sheet */}
                      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-600/5 rounded-full select-none pointer-events-none"></div>

                      {/* Left side: QR code column (35% width approx) */}
                      <div 
                        className={`flex flex-col items-center justify-center h-full pl-2 select-none border-l-2 border-dashed ${themeConfig[cardTheme].footerBorder}`}
                        style={{ width: '31mm', boxSizing: 'border-box' }}
                        dir="rtl"
                      >
                        <div className={`bg-white p-2 rounded-xl border-2 ${themeConfig[cardTheme].qrBorder} flex items-center justify-center shadow-sm`}>
                          <QRCodeCanvas 
                            value={student.id} 
                            size={280} 
                            bgColor={"#FFFFFF"}
                            fgColor={"#000000"} 
                            level={"H"}
                            includeMargin={false}
                            style={{ width: '70px', height: '70px' }} 
                          />
                        </div>
                        <div className={`text-[11px] font-mono font-black ${themeConfig[cardTheme].textMain} tracking-wider mt-1.5 px-2 py-0.5 ${themeConfig[cardTheme].badgeBg} border rounded`}>
                          {student.code}
                        </div>
                      </div>

                      {/* Right side: Student detail labels and info (65% width approx) */}
                      <div 
                        className="flex-1 pr-3 flex flex-col justify-between h-full text-right"
                        dir="rtl"
                        style={{ width: '51mm', boxSizing: 'border-box' }}
                      >
                        {/* Brand and Logo Header of Center */}
                        <div className={`border-b-2 border-dashed ${themeConfig[cardTheme].footerBorder} pb-1 ${themeConfig[cardTheme].headerBg} -mr-3 -mt-3 p-2 rounded-tr-lg`}>
                          <div className="flex items-center gap-1 justify-start">
                            <span className="w-2 h-2 rounded-full bg-red-600"></span>
                            <span className={`text-[10.5px] font-black ${themeConfig[cardTheme].textMain} tracking-tight`}>
                              {cardTitle}
                            </span>
                          </div>
                          <div className="text-[8.5px] text-slate-500 font-black -mt-0.5">
                            {cardTeacher}
                          </div>
                        </div>

                        {/* Student name */}
                        <div className="py-1">
                          <div className={`text-[8.5px] ${themeConfig[cardTheme].labelColor} font-black leading-none`}>اسم الطالب المنتسب:</div>
                          <div className="text-[12.5px] font-black text-black leading-tight mt-1 truncate max-w-[155px]" title={student.name}>
                            {student.name}
                          </div>
                        </div>

                        {/* Detail metadata list */}
                        <div className="space-y-0.5 text-[9.5px]">
                          <div className="text-black leading-none">
                            <span className={`${themeConfig[cardTheme].labelColor} font-bold`}>الصف:</span> <span className="text-black font-black">{student.grade}</span>
                          </div>
                          <div className="text-black leading-none truncate max-w-[155px]">
                            <span className={`${themeConfig[cardTheme].labelColor} font-bold`}>المجموعة:</span> <span className="text-black font-black">{groupName}</span>
                          </div>
                          {cardShowPhone && (
                            <div className="text-black leading-none">
                              <span className={`${themeConfig[cardTheme].labelColor} font-bold`}>موبايل الوالد:</span> <span className={`font-mono font-black ${themeConfig[cardTheme].phoneColor}`}>{student.parentPhone}</span>
                            </div>
                          )}
                          {cardShowAddress && (
                            <div className="text-black leading-none truncate max-w-[155px]">
                              <span className={`${themeConfig[cardTheme].labelColor} font-bold`}>منطقة السنتر:</span> <span className="text-black font-bold">{student.address || 'أسيوط'}</span>
                            </div>
                          )}
                        </div>

                        {/* Warning line at card bottom */}
                        <div className={`border-t border-dashed ${themeConfig[cardTheme].footerBorder} pt-1 text-[8px] ${themeConfig[cardTheme].footerText} text-center font-black`}>
                          * {cardFooter} *
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
              
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* SINGLE CARD PRINT CONTAINER (PORTALED TO BODY FOR FLAWLESS PRINTING) */}
      {selectedStudentForCard && createPortal(
        <div 
          className="print-single-card-container" 
          dir="rtl"
          style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            opacity: 0,
            pointerEvents: 'none'
          }}
        >
          <div 
            className={`bg-white p-5 rounded-3xl border-4 ${themeConfig[cardTheme].cardBorder} text-right relative shadow-none overflow-hidden space-y-3.5`}
            dir="rtl"
            style={{ 
              width: '92mm', 
              height: '62mm', 
              boxSizing: 'border-box',
              fontFamily: "'Cairo', 'Tahoma', 'Arial', sans-serif" 
            }}
          >
            {/* Background decoration */}
            <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-600/5 rounded-full pointer-events-none"></div>

            {/* Header */}
            <div className={`border-b-2 border-dashed ${themeConfig[cardTheme].footerBorder} pb-2.5 flex justify-between items-center ${themeConfig[cardTheme].headerBg} -mx-5 -mt-5 p-3.5`}>
              <div>
                <h4 className={`font-black ${themeConfig[cardTheme].textMain} ${fontSizeConfig[cardFontSize].brandTitle} tracking-tight`}>
                  {cardTitle}
                </h4>
                <p className={`font-black ${fontSizeConfig[cardFontSize].teacherName} ${themeConfig[cardTheme].footerText} mt-0.5`}>
                  {cardTeacher}
                </p>
              </div>
              <div className={`px-2.5 py-0.5 rounded-full ${fontSizeConfig[cardFontSize].codeText} font-mono font-black border ${themeConfig[cardTheme].badgeBg}`}>
                {selectedStudentForCard.code}
              </div>
            </div>

            {/* Student info */}
            <div className="space-y-2.5 pt-1.5">
              <div>
                <div className={`${fontSizeConfig[cardFontSize].studentNameLabel} ${themeConfig[cardTheme].labelColor} font-black`}>اسم الطالب المنتسب:</div>
                <div className={`font-black text-black ${fontSizeConfig[cardFontSize].studentNameVal} leading-tight mt-0.5 truncate max-w-[210px]`} title={selectedStudentForCard.name}>
                  {selectedStudentForCard.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <div className={`${fontSizeConfig[cardFontSize].detailsLabel} ${themeConfig[cardTheme].labelColor} font-black`}>الصف الملحق به:</div>
                  <div className={`${fontSizeConfig[cardFontSize].detailsText} font-black text-black leading-tight mt-0.5`}>{selectedStudentForCard.grade}</div>
                </div>
                <div>
                  <div className={`${fontSizeConfig[cardFontSize].detailsLabel} ${themeConfig[cardTheme].labelColor} font-black`}>اسم المجموعة:</div>
                  <div className={`${fontSizeConfig[cardFontSize].detailsText} font-black text-black leading-tight mt-0.5 truncate max-w-[100px]`}>
                    {groups.find(g => g.id === selectedStudentForCard.groupId)?.name || 'غير مخصص'}
                  </div>
                </div>
              </div>

              {(cardShowPhone || cardShowAddress) && (
                <div className={`pt-2 border-t ${themeConfig[cardTheme].footerBorder} flex justify-between items-center gap-1`}>
                  {cardShowPhone ? (
                    <div>
                      <div className={`${fontSizeConfig[cardFontSize].studentNameLabel} ${themeConfig[cardTheme].labelColor} font-black`}>موبايل ولي الأمر:</div>
                      <div className={`${fontSizeConfig[cardFontSize].phoneText} font-mono font-black ${themeConfig[cardTheme].phoneColor} tracking-wider mt-0.5`}>
                        {selectedStudentForCard.parentPhone}
                      </div>
                    </div>
                  ) : <div />}
                  {cardShowAddress ? (
                    <div className="text-[9px] text-slate-500 text-left leading-relaxed">
                      منطقة السنتر<br/>
                      <span className="font-bold text-black">{selectedStudentForCard.address || 'أسيوط'}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* QR Code Container */}
            <div className={`bg-white p-2.5 rounded-2xl border-2 ${themeConfig[cardTheme].qrBorder} flex items-center justify-center`}>
              <div className="relative">
                <QRCodeCanvas 
                  value={selectedStudentForCard.id} 
                  size={300}
                  bgColor={"#FFFFFF"}
                  fgColor={"#000000"}
                  level={"H"}
                  includeMargin={false}
                  style={{ width: '84px', height: '84px' }}
                />
              </div>
            </div>

            {/* Footer text */}
            <div className={`${fontSizeConfig[cardFontSize].footerText} ${themeConfig[cardTheme].footerText} text-center font-black pt-1 border-t border-dashed ${themeConfig[cardTheme].footerBorder}`}>
              * {cardFooter} *
            </div>
          </div>
        </div>,
        document.body
      )}

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
                  <option value="registration_approved">🎉 قبول واعتماد طلب التسجيل</option>
                  <option value="attendance">✅ حضور الطالب اليوم</option>
                  <option value="checkout">🚶‍♂️ انصراف وخروج الطالب</option>
                  <option value="absence">⚠️ غياب الطالب عن الحصة</option>
                  <option value="payment_reminder">🧾 تذكير بالمصروفات الشهرية</option>
                  <option value="announcement">📢 إعلان عام للمجموعة</option>
                  <option value="registration_rejected">❌ اعتذار/رفض طلب التسجيل</option>
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

      {/* Floating Bulk Operations Bar */}
      {selectedForBulk.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[45] bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center gap-4 animate-in slide-in-from-bottom-10 duration-300 max-w-2xl w-[90%] justify-between no-print">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full">{selectedForBulk.length}</span>
            <span className="text-xs font-semibold text-slate-200">طالب تم تحديدهم لإجراء مجمع</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleOpenBulkWhatsAppModal(selectedForBulk, 'registration_approved')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              إرسال مجمع (نجاح التسجيل)
            </button>
            <button
              onClick={() => handleOpenBulkWhatsAppModal(selectedForBulk, 'attendance')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              إرسال إشعار مجمع آخر
            </button>
            <button
              onClick={() => setSelectedForBulk([])}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* BULK WHATSAPP SENDER MODAL */}
      {bulkWhatsAppModal.isOpen && bulkWhatsAppModal.studentIds.length > 0 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 text-right no-print">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <button 
              onClick={() => setBulkWhatsAppModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute left-4 top-4 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 justify-end">
                <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
                بوابة الإرسال الجماعي الذكي عبر WhatsApp 🚀
              </h3>
              <p className="text-slate-500 text-[11px]">
                تتيح لك هذه الأداة مراجعة وإرسال الرسائل لـ <strong className="text-slate-800">({bulkWhatsAppModal.studentIds.length})</strong> طالب محدد واحد تلو الآخر لتجنب الحظر وبشكل متتالي سريع ومريح.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sidebar: Selected Students Queue */}
              <div className="md:col-span-1 border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3 flex flex-col h-[420px]">
                <h4 className="text-xs font-black text-slate-700 border-b border-slate-200 pb-2 flex items-center justify-between">
                  <span>طابور المتقدمين</span>
                  <span className="bg-slate-200/80 text-slate-750 px-2 py-0.5 rounded font-mono font-bold">
                    {bulkWhatsAppModal.studentIds.filter(id => bulkWhatsAppModal.sentStatus[id] === 'opened').length} / {bulkWhatsAppModal.studentIds.length} تم فتحهم
                  </span>
                </h4>
                <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1 space-y-1.5">
                  {bulkWhatsAppModal.studentIds.map((id, index) => {
                    const student = students.find(s => s.id === id);
                    if (!student) return null;
                    const isActive = index === bulkWhatsAppModal.currentIndex;
                    const isOpened = bulkWhatsAppModal.sentStatus[id] === 'opened';
                    return (
                      <button
                        key={id}
                        onClick={() => handleSelectBulkQueueIndex(index)}
                        className={`w-full text-right p-2.5 rounded-xl transition-all border flex items-center justify-between cursor-pointer ${
                          isActive 
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs' 
                            : isOpened 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                              : 'bg-white hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pl-2">
                          <p className={`text-xs truncate ${isActive ? 'text-white' : 'text-slate-800 font-bold'}`}>{student.name}</p>
                          <p className={`text-[10px] ${isActive ? 'text-indigo-200' : 'text-slate-400 font-medium'} mt-0.5`}>
                            {student.grade}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isOpened ? (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-white text-indigo-600' : 'bg-emerald-100 text-emerald-800'}`}>
                              تم التوجيه
                            </span>
                          ) : (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-indigo-700 text-white' : 'bg-slate-150 text-slate-600'}`}>
                              انتظار
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Area: Composer for Active Student */}
              <div className="md:col-span-2 space-y-4 flex flex-col h-[420px] justify-between">
                {bulkWhatsAppModal.currentIndex < bulkWhatsAppModal.studentIds.length ? (
                  (() => {
                    const activeStudentId = bulkWhatsAppModal.studentIds[bulkWhatsAppModal.currentIndex];
                    const student = students.find(s => s.id === activeStudentId);
                    if (!student) return null;
                    return (
                      <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                        {/* Selected Template Control */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1 text-right">
                            <label className="text-xs font-bold text-slate-600 block">قالب الإرسال للمجموعة الحالية</label>
                            <select
                              value={bulkWhatsAppModal.templateType}
                              onChange={(e) => handleBulkTemplateChange(e.target.value as any)}
                              className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl text-xs font-bold outline-none cursor-pointer"
                            >
                              <option value="registration_approved">🎉 قبول واعتماد طلب التسجيل</option>
                              <option value="attendance">✅ حضور الطالب اليوم</option>
                              <option value="checkout">🚶‍♂️ انصراف وخروج الطالب</option>
                              <option value="absence">⚠️ غياب الطالب عن الحصة</option>
                              <option value="payment_reminder">🧾 تذكير بالمصروفات الشهرية</option>
                              <option value="announcement">📢 إعلان عام للمجموعة</option>
                              <option value="registration_rejected">❌ اعتذار/رفض طلب التسجيل</option>
                              <option value="custom">✍️ إشعار مخصص حر (مخصوص)</option>
                            </select>
                          </div>

                          <div className="space-y-1 text-right">
                            <label className="text-xs font-bold text-slate-600 block">الطالب الحالي ({bulkWhatsAppModal.currentIndex + 1} من {bulkWhatsAppModal.studentIds.length})</label>
                            <div className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                              {student.name} | {student.parentPhone}
                            </div>
                          </div>
                        </div>

                        {/* TextArea Composer */}
                        <div className="space-y-1.5 text-right flex-1 flex flex-col">
                          <label className="text-xs font-bold text-slate-600 block">محتوى الرسالة الفردية التنبيهية</label>
                          <textarea
                            rows={6}
                            value={bulkWhatsAppModal.messageText}
                            onChange={(e) => setBulkWhatsAppModal(prev => ({ ...prev, messageText: e.target.value }))}
                            className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl text-xs outline-none transition text-right leading-relaxed font-sans resize-none flex-1"
                          />
                        </div>

                        <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-[10.5px] leading-relaxed flex items-start gap-2 text-emerald-900 font-medium">
                          <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            عند النقر على إرسال، سيتم تلقائياً فتح رابط محادثة WhatsApp لولي الأمر <strong className="text-emerald-950">{student.name}</strong>، ويتم نقلك تلقائياً للطالب التالي في طابور الانتظار بالأسفل!
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center animate-bounce">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-extrabold text-slate-900">اكتمل طابور الإرسال الجماعي بنجاح! 🎉</h4>
                      <p className="text-xs text-slate-500 max-w-md">
                        لقد قمت بمراجعة وتوجيه جميع رسائل الطلاب المحددة في الطابور بنجاح. يمكنك الآن إغلاق البوابة أو إلغاء التحديد.
                      </p>
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                  {bulkWhatsAppModal.currentIndex < bulkWhatsAppModal.studentIds.length ? (
                    <>
                      <button
                        onClick={handleSendCurrentBulkWhatsApp}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Send className="w-4 h-4" />
                        توجيه وإرسال الحالي 🚀
                      </button>
                      <button
                        onClick={handleSkipCurrentBulk}
                        className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        تخطي الحالي ⏭️
                      </button>
                    </>
                  ) : null}
                  <button
                    onClick={() => {
                      setBulkWhatsAppModal(prev => ({ ...prev, isOpen: false }));
                      setSelectedForBulk([]);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    إغلاق البوابة
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPROVAL CONFIRMATION MODAL WITH WHATSAPP */}
      {approvalModal.isOpen && approvalModal.student && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 text-right">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <button 
              onClick={() => setApprovalModal({ isOpen: false, student: null, sendWhatsApp: true, messageText: '' })}
              className="absolute left-4 top-4 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 justify-end">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                تأكيد اعتماد وقبول طلب التسجيل
              </h3>
              <p className="text-slate-500 text-[11px]">
                أنت على وشك قبول واعتماد طلب تسجيل الطالب: <strong className="text-slate-800">{approvalModal.student.name}</strong>
              </p>
            </div>

            {/* Form Fields/Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">الصف الدراسي:</span>
                <span className="font-bold text-slate-700">{approvalModal.student.grade}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">المجموعة المقترحة:</span>
                <span className="font-bold text-slate-700">
                  {groups.find(g => g.id === approvalModal.student?.groupId)?.name || 'مجموعة العلوم'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">رقم ولي الأمر:</span>
                <span className="font-mono font-bold text-slate-700">{approvalModal.student.parentPhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">كود الطالب المؤقت:</span>
                <span className="font-mono font-bold text-indigo-650">{approvalModal.student.code}</span>
              </div>
            </div>

            {/* Toggle WhatsApp Send */}
            <label className="flex items-center gap-2 justify-end cursor-pointer select-none py-1">
              <span className="text-xs font-bold text-slate-700">إرسال رسالة ترحيب وقبول على WhatsApp لولي الأمر</span>
              <input 
                type="checkbox" 
                checked={approvalModal.sendWhatsApp} 
                onChange={(e) => setApprovalModal(prev => ({ ...prev, sendWhatsApp: e.target.checked }))}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer animate-in duration-100"
              />
            </label>

            {/* Message Preview Textarea */}
            {approvalModal.sendWhatsApp && (
              <div className="space-y-1.5 text-right animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-xs font-bold text-slate-600 block">معاينة وتعديل نص رسالة الترحيب والقبول:</label>
                <textarea
                  rows={4}
                  value={approvalModal.messageText}
                  onChange={(e) => setApprovalModal(prev => ({ ...prev, messageText: e.target.value }))}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-xl text-xs outline-none transition text-right leading-relaxed font-sans"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={confirmApprove}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {approvalModal.sendWhatsApp ? <Send className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                {approvalModal.sendWhatsApp ? 'اعتماد وإرسال عبر WhatsApp' : 'اعتماد وقبول فقط'}
              </button>
              <button
                onClick={() => setApprovalModal({ isOpen: false, student: null, sendWhatsApp: true, messageText: '' })}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION CONFIRMATION MODAL WITH REASON & WHATSAPP */}
      {rejectionModal.isOpen && rejectionModal.student && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 text-right">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <button 
              onClick={() => setRejectionModal({ isOpen: false, student: null, reason: 'عدم اكتمال البيانات الأساسية المطلوبة', sendWhatsApp: true, messageText: '' })}
              className="absolute left-4 top-4 p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 justify-end">
                <AlertCircle className="w-5 h-5 text-red-600" />
                تأكيد رفض طلب التسجيل
              </h3>
              <p className="text-slate-500 text-[11px]">
                أنت على وشك رفض طلب تسجيل الطالب: <strong className="text-slate-800">{rejectionModal.student.name}</strong>
              </p>
            </div>

            {/* Select Rejection Reason */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-700 block">اختر سبب رفض الطلب أولاً:</label>
              <select
                value={rejectionModal.reason}
                onChange={(e) => handleRejectionReasonChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 rounded-xl text-xs font-bold outline-none transition cursor-pointer"
              >
                <option value="عدم اكتمال البيانات الأساسية المطلوبة">عدم اكتمال البيانات الأساسية المطلوبة</option>
                <option value="المجموعة المطلوبة ممتلئة بالكامل">المجموعة المطلوبة ممتلئة بالكامل</option>
                <option value="عدم ملاءمة المواعيد المتاحة مع رغبة الطالب">عدم ملاءمة المواعيد المتاحة مع رغبة الطالب</option>
                <option value="تكرار تقديم طلب تسجيل الطالب بالفعل">تكرار تقديم طلب تسجيل الطالب بالفعل</option>
                <option value="custom_reason">بيان سبب مخصص آخر...</option>
              </select>
            </div>

            {/* Custom Reason Input */}
            {rejectionModal.reason === 'custom_reason' && (
              <div className="space-y-1.5 text-right animate-in fade-in slide-in-from-top-1 duration-150">
                <label className="text-xs font-bold text-slate-600 block">اكتب سبب الرفض بالتفصيل:</label>
                <input
                  type="text"
                  placeholder="مثال: يرجى كتابة اسم المدرسة الحقيقي والتأكد من رقم ولي الأمر..."
                  onChange={(e) => {
                    const templates = dbEngine.getTemplates();
                    const tpl = templates.find(t => t.type === 'registration_rejected') || { text: 'نعتذر عن عدم قبول طلب تسجيل الطالب *[اسم_الطالب]* بسبب *[السبب]*' };
                    const text = formatNotificationTemplate(tpl.text, rejectionModal.student!, e.target.value || 'سبب مخصص');
                    setRejectionModal(prev => ({
                      ...prev,
                      messageText: text
                    }));
                  }}
                  className="w-full p-2.5 bg-white border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl text-xs outline-none text-right transition-all font-sans font-medium"
                />
              </div>
            )}

            {/* Toggle WhatsApp Send */}
            <label className="flex items-center gap-2 justify-end cursor-pointer select-none py-1">
              <span className="text-xs font-bold text-slate-700">إرسال رسالة اعتذار وتوضيح سبب الرفض على WhatsApp لولي الأمر</span>
              <input 
                type="checkbox" 
                checked={rejectionModal.sendWhatsApp} 
                onChange={(e) => setRejectionModal(prev => ({ ...prev, sendWhatsApp: e.target.checked }))}
                className="w-4 h-4 text-red-600 focus:ring-red-500 border-slate-300 rounded cursor-pointer animate-in duration-100"
              />
            </label>

            {/* Message Preview Textarea */}
            {rejectionModal.sendWhatsApp && (
              <div className="space-y-1.5 text-right animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-xs font-bold text-slate-600 block">معاينة وتعديل نص رسالة الاعتذار والرفض:</label>
                <textarea
                  rows={4}
                  value={rejectionModal.messageText}
                  onChange={(e) => setRejectionModal(prev => ({ ...prev, messageText: e.target.value }))}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-red-500 rounded-xl text-xs outline-none transition text-right leading-relaxed font-sans"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={confirmReject}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {rejectionModal.sendWhatsApp ? <Send className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {rejectionModal.sendWhatsApp ? 'رفض وإرسال اعتذار عبر WhatsApp' : 'تأكيد الرفض فقط'}
              </button>
              <button
                onClick={() => setRejectionModal({ isOpen: false, student: null, reason: 'عدم اكتمال البيانات الأساسية المطلوبة', sendWhatsApp: true, messageText: '' })}
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
