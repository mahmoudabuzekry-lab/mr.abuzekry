/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GradeType =
  | 'الصف الرابع الابتدائي'
  | 'الصف الخامس الابتدائي'
  | 'الصف السادس الابتدائي'
  | 'الصف الأول الإعدادي'
  | 'الصف الثاني الإعدادي'
  | 'الصف الثالث الإعدادي';

export const ALL_GRADES: GradeType[] = [
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي'
];

export type UserRole = 'teacher' | 'parent' | 'student';

export type StudentStatus = 'pending' | 'approved' | 'rejected';

export type ExemptionType = 'none' | 'full' | 'partial';

export interface Student {
  id: string;
  code: string; // Dynamic code like S-1002
  name: string;
  phone: string;
  parentPhone: string;
  grade: GradeType;
  school: string;
  address: string;
  groupId: string; // References Group.id
  alternativeGroupIds?: string[]; // Alternative groups the student is allowed to attend (flexible/substitute days)
  alternativeGroupDays?: Record<string, string[]>; // Map of alternative group ID to specific allowed attendance days (e.g. { "grp1": ["الأحد"] })
  attendanceDays?: string[]; // Weekly attendance days (custom flexible schedule)
  notes?: string;
  status: StudentStatus;
  exemptionType: ExemptionType;
  discountAmount: number; // For partial exemptions
  customPrice?: number; // سعر اشتراك مخصص فردي للطالب (اختياري)
  isSiblingApproved?: boolean; // Whether duplicate accounts have been approved as siblings
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  grade: GradeType;
  day: string;
  time: string;
  maxCapacity: number;
  location: string;
  currentCount: number;
  isSpecial?: boolean; // هل هي مجموعة خاصة/مميزة (VIP)
  type?: 'standard' | 'special'; // نوع المجموعة (عادية / خاصة)
  customPrice?: number; // سعر الاشتراك الشهري المخصص للمجموعة الخاصة (ج.م)
  notes?: string; // مميزات أو ملاحظات المجموعة الخاصة
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  grade: GradeType;
  month: string; // e.g. "يونيو 2026"
  amountPaid: number;
  amountDue: number; // Subscription price of grade minus discounts/exemptions
  date: string;
  paymentMethod: string; // 'نقدي' | 'فودافون كاش' | 'فيزا' | 'أخرى'
  notes?: string;
  receivedBy?: string; // اسم المستلم / المحصل (اختياري)
}

export interface Attendance {
  id: string; // studentId_date
  studentId: string;
  studentName: string;
  groupId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

export interface Exam {
  id: string;
  title: string;
  grade: GradeType;
  date: string;
  maxScore: number;
}

export interface ExamScore {
  id: string; // examId_studentId
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  score: number;
  notes?: string;
}

export interface WhatsAppTemplate {
  id: string;
  title: string;
  type: 'attendance' | 'checkout' | 'absence' | 'payment_reminder' | 'exam_result' | 'announcement' | 'custom' | 'registration_approved' | 'registration_rejected';
  text: string;
}

export interface GradePrice {
  grade: GradeType;
  price: number;
}

export interface RegistrationSettings {
  isGloballyEnabled: boolean;
  disabledGrades: GradeType[];
}

export interface SiblingDiscountPolicy {
  enabled: boolean;
  type: 'fixed' | 'percentage'; // مبلغ ثابت أو نسبة مئوية
  amount: number; // قيمة الخصم (مثلاً 50 ج.م أو 20%)
  applyTo: 'second_plus' | 'all'; // تطبيق على الأخ الثاني فما بعد أو جميع الإخوة
}

export interface ReceiptSettings {
  centerName: string; // e.g. "مجموعات العلوم المتطورة"
  teacherName: string; // e.g. "الأستاذ محمود أبوذكري"
  subTitle: string; // e.g. "سجل المتابعة والتفوق الأكاديمي الرقمي"
  receiptTitle: string; // e.g. "إيصال استلام مالي"
  phone: string; // رقم هاتف للتواصل
  address: string; // العنوان أو مقر الدرس
  footerMessage: string; // عبارة الشكر والختام
  receiverName: string; // اسم المستلم الافتراضي
  showQrCode: boolean;
  showSignature: boolean;
  showAmountDue: boolean;
  showNotes: boolean;
  showPhone: boolean;
  showWatermark: boolean;
  receiptSize: 'thermal' | 'standard'; // 'thermal' (كاشير/حراري 80mm) | 'standard' (بطاقة مقاس قياسي)
  whatsappMessageTemplate?: string; // قالب نص رسالة المصروفات/الإيصال عبر واتساب
}

export const DEFAULT_WHATSAPP_RECEIPT_TEMPLATE = `السلام عليكم ورحمة الله وبركاته 🌸
تحية طيبة لولي أمر الطالب/ـة: *[اسم_الطالب]* المحترم/ـة،

يسر إدارة *[اسم_السنتر]* - *[اسم_المعلم]* إفادتكم بصدور وتأكيد إيصال الاستلام المالي:

🧾 *بيانات إيصال السداد المالي:*
━━━━━━━━━━━━━━━
🔹 *رقم السند:* #[رقم_السند]
🔹 *اسم الطالب:* [اسم_الطالب]
🔹 *الصف الدراسي:* [الصف_الدراسي]
🔹 *عن رسوم شهر:* [الشهر]
🔹 *المبلغ المقبوض:* [المبلغ] ج.م (خالص ومسدد ✅)
🔹 *تاريخ التحصيل:* [التاريخ]
🔹 *طريقة الدفع:* [طريقة_الدفع]
━━━━━━━━━━━━━━━
✨ نشكركم دائماً على حسن تعاونكم وثقتكم الغالية، متمنين لأبنائنا دوام التفوق والتميز الباهر 🌟
[خاتمة_الإيصال]
[هاتف_التواصل]`;

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  centerName: 'مجموعات العلوم المتطورة',
  teacherName: 'الأستاذ محمود أبوذكري',
  subTitle: 'سجل المتابعة والتفوق الأكاديمي الرقمي',
  receiptTitle: 'إيصال استلام مالي',
  phone: '',
  address: '',
  footerMessage: '* نشكركم على ثقتكم الغالية، تمنياتنا دائماً بدوام المجد والتفوق *',
  receiverName: 'إدارة السنتر / أ. محمود أبوذكري',
  showQrCode: true,
  showSignature: true,
  showAmountDue: true,
  showNotes: true,
  showPhone: true,
  showWatermark: true,
  receiptSize: 'standard',
  whatsappMessageTemplate: DEFAULT_WHATSAPP_RECEIPT_TEMPLATE
};

export const ARABIC_MONTHS_MAP: { [key: string]: number } = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4,
  'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8,
  'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
};

function parseArabicDigits(str: string): string {
  const map: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return str.replace(/[٠-٩]/g, (d) => map[d] || d);
}

export function doesMonthPrecedeDate(monthStr: string, dateIsoStr: string): boolean {
  if (!dateIsoStr) return false;
  
  const normalizedStr = parseArabicDigits(monthStr).replace(/,/g, ' ');
  const parts = normalizedStr.split(/\s+/).filter(Boolean);
  
  let targetMonth = 1;
  let targetYear = 0;
  let yearFound = false;
  
  for (const part of parts) {
    for (const [mName, mVal] of Object.entries(ARABIC_MONTHS_MAP)) {
      if (part.includes(mName)) {
        targetMonth = mVal;
        break;
      }
    }
    
    const parsedNum = parseInt(part, 10);
    if (!isNaN(parsedNum) && parsedNum > 1900) {
      targetYear = parsedNum;
      yearFound = true;
    }
  }

  const regDate = new Date(dateIsoStr);
  if (isNaN(regDate.getTime())) return false;
  
  const regYear = regDate.getFullYear();
  const regMonth = regDate.getMonth() + 1;

  if (yearFound) {
    const targetAbs = targetYear * 12 + targetMonth;
    const regAbs = regYear * 12 + regMonth;
    return targetAbs < regAbs;
  }

  // If year is not explicitly specified in monthStr:
  // Determine which academic year session the student was registered in.
  // Standard academic year starts around July/August (month 7 or 8).
  // If registered in July-Dec (regMonth >= 7), acadStartYear = regYear.
  // If registered in Jan-Jun (regMonth < 7), acadStartYear = regYear - 1.
  const acadStartYear = regMonth >= 7 ? regYear : regYear - 1;

  // Months 8..12 (Aug..Dec) belong to acadStartYear.
  // Months 1..7 (Jan..Jul) belong to acadStartYear + 1.
  targetYear = targetMonth >= 8 ? acadStartYear : acadStartYear + 1;

  const targetAbs = targetYear * 12 + targetMonth;
  const regAbs = regYear * 12 + regMonth;

  return targetAbs < regAbs;
}

export function getCurrentArabicMonthName(): string {
  const ALL_ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthIndex = new Date().getMonth();
  return ALL_ARABIC_MONTHS[currentMonthIndex];
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const map: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  let clean = phone.replace(/[٠-٩]/g, (d) => map[d] || d);
  clean = clean.replace(/[^\d+]/g, '');
  if (clean.startsWith('+20')) clean = '0' + clean.slice(3);
  else if (clean.startsWith('0020')) clean = '0' + clean.slice(4);
  else if (clean.startsWith('20') && clean.length === 12) clean = '0' + clean.slice(2);
  return clean.trim();
}

export function formatReceiptWhatsAppMessage(
  payment: {
    id?: string;
    studentId?: string;
    studentName?: string;
    studentCode?: string;
    grade?: string;
    month?: string;
    amountPaid?: number;
    amountDue?: number;
    date?: string;
    paymentMethod?: string;
    receivedBy?: string;
    notes?: string;
  },
  settings: ReceiptSettings,
  customTemplateOverride?: string
): string {
  const rawTemplate = (customTemplateOverride !== undefined && customTemplateOverride !== '')
    ? customTemplateOverride
    : (settings.whatsappMessageTemplate && settings.whatsappMessageTemplate.trim() !== '')
      ? settings.whatsappMessageTemplate
      : DEFAULT_WHATSAPP_RECEIPT_TEMPLATE;

  const teacher = settings.teacherName || 'الأستاذ محمود أبوذكري';
  const center = settings.centerName || 'مجموعات العلوم المتطورة';
  const contactPhone = settings.phone ? `📞 *للتواصل والاستفسار:* ${settings.phone}` : (settings.phone || '');
  const receiver = payment.receivedBy || settings.receiverName || 'إدارة المركز';
  const notes = payment.notes ? `📝 *ملاحظات السداد:* ${payment.notes}` : '';
  const footer = settings.footerMessage ? `_${settings.footerMessage}_` : '';
  const payMethod = payment.paymentMethod || 'نقدي';
  
  const paid = payment.amountPaid ?? 0;
  const due = payment.amountDue ?? paid;
  const remaining = Math.max(0, due - paid);

  let message = rawTemplate
    // Student Info
    .replace(/\[(اسم_الطالب|الطالب|اسم_الطالبة)\]/g, payment.studentName || '')
    .replace(/\[(كود_الطالب|الكود|رقم_الطالب)\]/g, payment.studentCode || '')
    .replace(/\[(الصف_الدراسي|الصف|المرحلة|المرحلة_الدراسية)\]/g, payment.grade || '')
    .replace(/\[(الشهر|شهر_المصروفات|شهر|عن_شهر)\]/g, payment.month || '')
    // Financial figures
    .replace(/\[(المبلغ_المدفوع|المبلغ_المسدد|المبلغ|القيمة_المسددة|المسدد)\]/g, String(paid))
    .replace(/\[(المبلغ_المستحق|المقرر_الشهري|إجمالي_الرسوم|الرسوم|المستحق)\]/g, String(due))
    .replace(/\[(المبلغ_المتبقي|المتبقي|المتبقي_المطلوب|الباقي)\]/g, String(remaining))
    // Receipt Metadata
    .replace(/\[(رقم_السند|رقم_الإيصال|رقم_الوصل|رقم_العملية|السند|الإيصال)\]/g, String(payment.id || ''))
    .replace(/\[(التاريخ|تاريخ_السداد|تاريخ_التحصيل|تاريخ_الإيصال|تاريخ_العملية)\]/g, payment.date || new Date().toISOString().split('T')[0])
    .replace(/\[(طريقة_الدفع|طريقة_السداد|وسيلة_الدفع)\]/g, payMethod)
    .replace(/\[(المستلم|المحصل|اسم_المستلم|المسؤول)\]/g, receiver)
    .replace(/\[(الملاحظات|ملاحظات_السداد|ملاحظات)\]/g, notes)
    // Teacher & Center Info
    .replace(/\[(اسم_المعلم|المعلم|الأستاذ)\]/g, teacher)
    .replace(/\[(اسم_السنتر|السنتر|اسم_المركز|المركز)\]/g, center)
    .replace(/\[(هاتف_التواصل|رقم_التواصل|هاتف_السنتر|هاتف_المعلم|رقم_الهاتف|الهاتف)\]/g, contactPhone)
    .replace(/\[(خاتمة_الإيصال|رسالة_التذييل|التذييل|الخاتمة)\]/g, footer);

  return message.replace(/\n{3,}/g, '\n\n').trim();
}




