/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Group, Payment, Attendance, Exam, ExamScore, WhatsAppTemplate, GradeType, ExemptionType } from './types';

// Price mapping for each grade
export const DEFAULT_GRADE_PRICES: Record<GradeType, number> = {
  'الصف الرابع الابتدائي': 80,
  'الصف الخامس الابتدائي': 85,
  'الصف السادس الابتدائي': 90,
  'الصف الأول الإعدادي': 100,
  'الصف الثاني الإعدادي': 110,
  'الصف الثالث الإعدادي': 120,
};

const STORAGE_KEYS = {
  STUDENTS: 'abuzekry_students',
  GROUPS: 'abuzekry_groups',
  PAYMENTS: 'abuzekry_payments',
  ATTENDANCE: 'abuzekry_attendance',
  EXAMS: 'abuzekry_exams',
  EXAM_SCORES: 'abuzekry_exam_scores',
  WHATSAPP_TEMPLATES: 'abuzekry_templates',
  GRADE_PRICES: 'abuzekry_grade_prices',
};

// Seed Data
const INITIAL_GROUPS: Group[] = [
  { id: 'g1', name: 'مجموعة نيوتن (أ)', grade: 'الصف الثالث الإعدادي', day: 'السبت والإيجار المتبادل', time: '04:00 م', maxCapacity: 25, location: 'السنتر الرئيسي - القاعة 1', currentCount: 4 },
  { id: 'g2', name: 'مجموعة أينشتاين (ب)', grade: 'الصف الثالث الإعدادي', day: 'الأحد والثلاثاء', time: '06:00 م', maxCapacity: 20, location: 'السنتر الرئيسي - القاعة 2', currentCount: 2 },
  { id: 'g3', name: 'مجموعة جاليليو (أ)', grade: 'الصف الأول الإعدادي', day: 'الإثنين والخميس', time: '04:00 م', maxCapacity: 30, location: 'سنتر النور - القاعة 3', currentCount: 3 },
  { id: 'g4', name: 'مجموعة جابر بن حيان', grade: 'الصف الثاني الإعدادي', day: 'السبت والأربعاء', time: '02:00 م', maxCapacity: 25, location: 'سنتر النخبة', currentCount: 2 },
  { id: 'g5', name: 'مجموعة الفارابي (أ)', grade: 'الصف الرابع الابتدائي', day: 'الأحد', time: '03:00 م', maxCapacity: 15, location: 'مكتب المعلم الخاص', currentCount: 2 },
  { id: 'g6', name: 'مجموعة البيروني (ب)', grade: 'الصف السادس الابتدائي', day: 'الثلاثاء', time: '03:00 م', maxCapacity: 20, location: 'سنتر النور - القاعة 1', currentCount: 1 },
];

const INITIAL_STUDENTS: Student[] = [
  { id: 's1', code: 'S-1001', name: 'أحمد محمود عبد الخالق', phone: '01012345678', parentPhone: '01198765432', grade: 'الصف الثالث الإعدادي', school: 'طه حسين الإعدادية بنين', address: 'وسط البلد، أسيوط', groupId: 'g1', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-10T10:00:00Z' },
  { id: 's2', code: 'S-1002', name: 'محمد علي كريم', phone: '01234567890', parentPhone: '01511122233', grade: 'الصف الثالث الإعدادي', school: 'صلاح الدين الإعدادية بأسيوط', address: 'حي السادات، أسيوط', groupId: 'g1', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-11T11:30:00Z' },
  { id: 's3', code: 'S-1003', name: 'ياسمين ممدوح شرف', phone: '01066778899', parentPhone: '01144556677', grade: 'الصف الثالث الإعدادي', school: 'الخنساء الإعدادية بنات', address: 'الهلالي، أسيوط', groupId: 'g1', status: 'approved', exemptionType: 'partial', discountAmount: 50, createdAt: '2026-05-12T09:15:00Z' },
  { id: 's4', code: 'S-1004', name: 'عبد الرحمن ياسر فوزي', phone: '01288991122', parentPhone: '01022334455', grade: 'الصف الثالث الإعدادي', school: 'التحرير الإعدادية بنين', address: 'النزلة، أسيوط', groupId: 'g1', status: 'approved', exemptionType: 'full', discountAmount: 0, createdAt: '2026-05-12T14:20:00Z' },
  { id: 's5', code: 'S-1005', name: 'منة الله أشرف رضا', phone: '01555443322', parentPhone: '01222445566', grade: 'الصف الثالث الإعدادي', school: 'الشهيد محمد رأفت بنات', address: 'شارع النميس، أسيوط', groupId: 'g2', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-14T10:00:00Z' },
  { id: 's6', code: 'S-1006', name: 'خالد مصطفى بكري', phone: '01122334499', parentPhone: '01000998877', grade: 'الصف الثالث الإعدادي', school: 'التحرير الإعدادية', address: 'غرب مسيل الكعك، أسيوط', groupId: 'g2', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-14T13:45:00Z' },
  
  { id: 's7', code: 'S-2001', name: 'أنس محمود أبو ذكري', phone: '01099887766', parentPhone: '01122334455', grade: 'الصف الأول الإعدادي', school: 'الشهيد يحيى الإعدادية', address: 'شارع الجمهورية، أسيوط', groupId: 'g3', status: 'approved', exemptionType: 'full', discountAmount: 0, createdAt: '2026-05-15T08:00:00Z' },
  { id: 's8', code: 'S-2002', name: 'حبيبة وائل جاد', phone: '01211122244', parentPhone: '01055566677', grade: 'الصف الأول الإعدادي', school: 'عصمت عفيفي الإعدادية', address: 'شارع المحافظة، أسيوط', groupId: 'g3', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-16T12:00:00Z' },
  { id: 's9', code: 'S-2003', name: 'ندى أحمد جلال', phone: '01512345678', parentPhone: '01199885544', grade: 'الصف الأول الإعدادي', school: 'المعلمات الإعدادية بنات', address: 'الفاتح، أسيوط', groupId: 'g3', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-17T15:10:00Z' },
  
  { id: 's10', code: 'S-3001', name: 'تامر حسني صيام', phone: '01088776655', parentPhone: '01211223344', grade: 'الصف الثاني الإعدادي', school: 'الفتح الإعدادية بنين', address: 'الفتح، أسيوط', groupId: 'g4', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-18T10:30:00Z' },
  { id: 's11', code: 'S-3002', name: 'شهد عبد الرحيم كمال', phone: '01111222333', parentPhone: '01555666999', grade: 'الصف الثاني الإعدادي', school: 'اليرموك الإعدادية', address: 'السادات، أسيوط', groupId: 'g4', status: 'approved', exemptionType: 'partial', discountAmount: 40, createdAt: '2026-05-18T11:00:00Z' },
  
  { id: 's12', code: 'S-4001', name: 'مروان هيثم رجب', phone: '01222333444', parentPhone: '01099998888', grade: 'الصف الرابع الابتدائي', school: 'أم المؤمنين الابتدائية', address: 'النميس، أسيوط', groupId: 'g5', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-19T09:00:00Z' },
  { id: 's13', code: 'S-4002', name: 'فريدة إسلام شحاتة', phone: '01544332211', parentPhone: '01177665544', grade: 'الصف الرابع الابتدائي', school: 'النهضة الرسمية لغات', address: 'فريال، أسيوط', groupId: 'g5', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-19T10:15:00Z' },
  
  { id: 's14', code: 'S-5001', name: 'عمر جابر الهواري', phone: '01055443312', parentPhone: '01255556666', grade: 'الصف السادس الابتدائي', school: 'النيل متميزة لغات', address: 'أرض الملاعب، أسيوط', groupId: 'g6', status: 'approved', exemptionType: 'none', discountAmount: 0, createdAt: '2026-05-20T16:00:00Z' },
  
  // Pending students (waiting for approval)
  { id: 's_p1', code: 'S-PEND-1', name: 'ضياء السعيد النجار', phone: '01011122255', parentPhone: '01566644422', grade: 'الصف الثالث الإعدادي', school: 'شمال الإعدادية بنين', address: 'جامعة أسيوط، أسيوط', groupId: 'g1', status: 'pending', exemptionType: 'none', discountAmount: 0, createdAt: '2026-06-21T09:00:00Z' },
  { id: 's_p2', code: 'S-PEND-2', name: 'سارة نور الدين فرج', phone: '01133344455', parentPhone: '01288877766', grade: 'الصف الأول الإعدادي', school: 'النخبة الخاصة بمصر', address: 'شطا، أسيوط', groupId: 'g3', status: 'pending', exemptionType: 'none', discountAmount: 0, createdAt: '2026-06-22T06:30:00Z' }
];

const INITIAL_EXAMS: Exam[] = [
  { id: 'e1', title: 'اختبار نصف شهر مايو - كيمياء وفيزياء', grade: 'الصف الثالث الإعدادي', date: '2026-05-18', maxScore: 20 },
  { id: 'e2', title: 'اختبار دوري - الطاقات والحرارة', grade: 'الصف الأول الإعدادي', date: '2026-05-20', maxScore: 15 },
  { id: 'e3', title: 'اختبار تجريبي - الوحدة الأولى والثانية', grade: 'الصف الثاني الإعدادي', date: '2026-05-22', maxScore: 30 }
];

const INITIAL_EXAM_SCORES: ExamScore[] = [
  // Class 3 Prep exam scores
  { id: 'e1_s1', examId: 'e1', examTitle: 'اختبار نصف شهر مايو - كيمياء وفيزياء', studentId: 's1', studentName: 'أحمد محمود عبد الخالق', score: 19 },
  { id: 'e1_s2', examId: 'e1', examTitle: 'اختبار نصف شهر مايو - كيمياء وفيزياء', studentId: 's2', studentName: 'محمد علي كريم', score: 17, notes: 'ممتاز ويجب الحفاظ على التركيز' },
  { id: 'e1_s3', examId: 'e1', examTitle: 'اختبار نصف شهر مايو - كيمياء وفيزياء', studentId: 's3', studentName: 'ياسمين ممدوح شرف', score: 15 },
  { id: 'e1_s4', examId: 'e1', examTitle: 'اختبار نصف شهر مايو - كيمياء وفيزياء', studentId: 's4', studentName: 'عبد الرحمن ياسر فوزي', score: 20, notes: 'الدرجة النهائية - بارك الله فيك' },
  { id: 'e1_s5', examId: 'e1', examTitle: 'اختبار نصف شهر مايو - كيمياء وفيزياء', studentId: 's5', studentName: 'منة الله أشرف رضا', score: 11, notes: 'مستواها يحتاج لمزيد من المتابعة وحل تدريبات' },
  { id: 'e1_s6', examId: 'e1', examTitle: 'اختبار نصف شهر مايو - كيمياء وفيزياء', studentId: 's6', studentName: 'خالد مصطفى بكري', score: 8, notes: 'ضعيف - مقصر في الواجبات اليومية' },
  
  // Class 1 Prep exam scores
  { id: 'e2_s7', examId: 'e2', examTitle: 'اختبار دوري - الطاقات والحرارة', studentId: 's7', studentName: 'أنس محمود أبو ذكري', score: 15, notes: 'ممتاز، كفو يا بطل' },
  { id: 'e2_s8', examId: 'e2', examTitle: 'اختبار دوري - الطاقات والحرارة', studentId: 's8', studentName: 'حبيبة وائل جاد', score: 13 },
  { id: 'e2_s9', examId: 'e2', examTitle: 'اختبار دوري - الطاقات والحرارة', studentId: 's9', studentName: 'ندى أحمد جلال', score: 9, notes: 'تحتاج لمراجعة المفاهيم السابقة' }
];

const INITIAL_PAYMENTS: Payment[] = [
  // Payments for May 2026
  { id: 'p1', studentId: 's1', studentName: 'أحمد محمود عبد الخالق', grade: 'الصف الثالث الإعدادي', month: 'مايو 2026', amountPaid: 120, amountDue: 120, date: '2026-05-05', paymentMethod: 'نقدي' },
  { id: 'p2', studentId: 's2', studentName: 'محمد علي كريم', grade: 'الصف الثالث الإعدادي', month: 'مايو 2026', amountPaid: 120, amountDue: 120, date: '2026-05-05', paymentMethod: 'نقدي' },
  { id: 'p3', studentId: 's3', studentName: 'ياسمين ممدوح شرف', grade: 'الصف الثالث الإعدادي', month: 'مايو 2026', amountPaid: 70, amountDue: 70, date: '2026-05-06', paymentMethod: 'فودافون كاش', notes: 'خصم جزئي 50 جينهاً' },
  { id: 'p4', studentId: 's4', studentName: 'عبد الرحمن ياسر فوزي', grade: 'الصف الثالث الإعدادي', month: 'مايو 2026', amountPaid: 0, amountDue: 0, date: '2026-05-06', paymentMethod: 'أخرى', notes: 'إعفاء كامل لأسباب تفوق' },
  { id: 'p5', studentId: 's5', studentName: 'منة الله أشرف رضا', grade: 'الصف الثالث الإعدادي', month: 'مايو 2026', amountPaid: 120, amountDue: 120, date: '2026-05-08', paymentMethod: 'نقدي' },
  
  { id: 'p6', studentId: 's7', studentName: 'أنس محمود أبو ذكري', grade: 'الصف الأول الإعدادي', month: 'مايو 2026', amountPaid: 0, amountDue: 0, date: '2026-05-01', paymentMethod: 'أخرى', notes: 'ابن الأستاذ - إعفاء كامل' },
  { id: 'p7', studentId: 's8', studentName: 'حبيبة وائل جاد', grade: 'الصف الأول الإعدادي', month: 'مايو 2026', amountPaid: 100, amountDue: 100, date: '2026-05-03', paymentMethod: 'نقدي' },
  
  // June 2026 Payments
  { id: 'p8', studentId: 's1', studentName: 'أحمد محمود عبد الخالق', grade: 'الصف الثالث الإعدادي', month: 'يونيو 2026', amountPaid: 120, amountDue: 120, date: '2026-06-04', paymentMethod: 'نقدي' },
  { id: 'p9', studentId: 's3', studentName: 'ياسمين ممدوح شرف', grade: 'الصف الثالث الإعدادي', month: 'يونيو 2026', amountPaid: 70, amountDue: 70, date: '2026-06-05', paymentMethod: 'فودافون كاش' }
];

const INITIAL_ATTENDANCE: Attendance[] = [
  // Attendance on May 16, 2026 (Group 1 - Newton A)
  { id: 's1_2026-05-16', studentId: 's1', studentName: 'أحمد محمود عبد الخالق', groupId: 'g1', date: '2026-05-16', status: 'present', checkInTime: '03:55 م', checkOutTime: '05:30 م' },
  { id: 's2_2026-05-16', studentId: 's2', studentName: 'محمد علي كريم', groupId: 'g1', date: '2026-05-16', status: 'present', checkInTime: '03:58 م', checkOutTime: '05:28 م' },
  { id: 's3_2026-05-16', studentId: 's3', studentName: 'ياسمين ممدوح شرف', groupId: 'g1', date: '2026-05-16', status: 'present', checkInTime: '04:02 م', checkOutTime: '05:32 م' },
  { id: 's4_2026-05-16', studentId: 's4', studentName: 'عبد الرحمن ياسر فوزي', groupId: 'g1', date: '2026-05-16', status: 'present', checkInTime: '03:50 م', checkOutTime: '05:30 م' },
  
  // Attendance on May 23, 2026 (Group 1 - Newton A)
  { id: 's1_2026-05-23', studentId: 's1', studentName: 'أحمد محمود عبد الخالق', groupId: 'g1', date: '2026-05-23', status: 'present', checkInTime: '03:55 م' },
  { id: 's2_2026-05-23', studentId: 's2', studentName: 'محمد علي كريم', groupId: 'g1', date: '2026-05-23', status: 'late', checkInTime: '04:20 م', checkOutTime: '05:30 م' },
  { id: 's3_2026-05-23', studentId: 's3', studentName: 'ياسمين ممدوح شرف', groupId: 'g1', date: '2026-05-23', status: 'absent' },
  { id: 's4_2026-05-23', studentId: 's4', studentName: 'عبد الرحمن ياسر فوزي', groupId: 'g1', date: '2026-05-23', status: 'present', checkInTime: '03:51 م', checkOutTime: '05:31 م' },
];

const INITIAL_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 't1',
    title: 'إشعار تسجيل حضور بنجاح ✅',
    type: 'attendance',
    text: 'ولي الأمر العزيز، نحيطكم علماً بأن الطالب/الطالبة *[اسم_الطالب]* قد حضر اليوم درس العلوم لمجموعة *[اسم_المجموعة]* في تمام الساعة *[الوقت]*. مع تحيات الأستاذ محمود أبوذكري.'
  },
  {
    id: 't2',
    title: 'تنبيه غياب الطالب ⚠️',
    type: 'absence',
    text: 'ولي الأمر العزيز، نود إتصالكم لمراجعة غياب الطالب/الطالبة *[اسم_الطالب]* اليوم عن حضور حصة مادة العلوم المقررة لمجموعة *[اسم_المجموعة]* بتاريخ *[التاريخ]*. يرجى المتابعة لعدم فوات المنهج. الأستاذ محمود أبوذكري.'
  },
  {
    id: 't3',
    title: 'تذكير بمصروفات الاشتراك الشهري 🧾',
    type: 'payment_reminder',
    text: 'ولي الأمر الفاضل، نحيطكم علماً بأن الاشتراك الشهري المستحق لدرس العلوم لشهر *[الشهر]* الخاص بالطالب/الطالبة *[اسم_الطالب]* (الصف: *[الصف_الدراسي]*، المجموعة: *[اسم_المجموعة]*) هو *[المبلغ]* جنيهاً مصرياً. يرجى التكرم بالسداد في أقرب وقت. شاكرين حسن تعاونكم. الأستاذ محمود أبوذكري.'
  },
  {
    id: 't4',
    title: 'إشعار نتيجة اختبار دوري 🏆',
    type: 'exam_result',
    text: 'تهانينا! نود إعلامكم بنتيجة الطالب/الطالبة *[اسم_الطالب]* في *[اسم_الاختبار]* لمادة العلوم. الدرجة: *[الدرجة]* من *[الدرجة_النهائية]* (مستوى التقييم: *[التقييم]*). فخورين بجهوده ونتطلع للمزيد من التميز. الأستاذ محمود أبوذكري.'
  },
  {
    id: 't5',
    title: 'إعلان عام للمجموعة 📢',
    type: 'announcement',
    text: 'أبنائي الطلبة وأولياء الأمور الأفاضل بمجموعة *[اسم_المجموعة]*، نحيطكم علماً بأن الحصة القادمة ستشمل مراجعة شاملة وحل أسئلة بنك المعرفة على الوحدة السابقة، يرجى الاستعداد الجيد وإحضار كراسة التدريبات. الأستاذ محمود أبوذكري.'
  }
];

// Local DB Engine class
class LocalDatabase {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Local Storage error', e);
    }
  }

  constructor() {
    this.init();
  }

  public init() {
    if (!localStorage.getItem(STORAGE_KEYS.GROUPS)) {
      this.set(STORAGE_KEYS.GROUPS, INITIAL_GROUPS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
      this.set(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EXAMS)) {
      this.set(STORAGE_KEYS.EXAMS, INITIAL_EXAMS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EXAM_SCORES)) {
      this.set(STORAGE_KEYS.EXAM_SCORES, INITIAL_EXAM_SCORES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS)) {
      this.set(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      this.set(STORAGE_KEYS.ATTENDANCE, INITIAL_ATTENDANCE);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WHATSAPP_TEMPLATES)) {
      this.set(STORAGE_KEYS.WHATSAPP_TEMPLATES, INITIAL_TEMPLATES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.GRADE_PRICES)) {
      this.set(STORAGE_KEYS.GRADE_PRICES, DEFAULT_GRADE_PRICES);
    }
    this.sanitizeAndRepairDuplicates();
  }

  public sanitizeAndRepairDuplicates(): void {
    const students = this.getStudents();
    const seenIds = new Set<string>();
    let hasChanges = false;
    
    // A list of repair mappings: { oldId, studentName, newId }
    const repairs: { oldId: string; name: string; newId: string }[] = [];
    
    const sanitizedStudents = students.map((student, idx) => {
      if (!student.id) {
        const newId = `s_${Date.now()}_r_${idx}_${Math.floor(Math.random() * 1000)}`;
        hasChanges = true;
        return { ...student, id: newId };
      }
      
      if (seenIds.has(student.id)) {
        // Duplicate ID found!
        const newId = `s_${Date.now()}_r_${idx}_${Math.floor(Math.random() * 1000)}`;
        repairs.push({ oldId: student.id, name: student.name, newId });
        hasChanges = true;
        return { ...student, id: newId };
      }
      
      seenIds.add(student.id);
      return student;
    });

    if (hasChanges) {
      this.set(STORAGE_KEYS.STUDENTS, sanitizedStudents);
      
      if (repairs.length > 0) {
        // Repair Payments
        const payments = this.getPayments();
        let paymentsChanged = false;
        const updatedPayments = payments.map(p => {
          const match = repairs.find(r => r.oldId === p.studentId && r.name === p.studentName);
          if (match) {
            paymentsChanged = true;
            return { ...p, studentId: match.newId };
          }
          return p;
        });
        if (paymentsChanged) {
          this.set(STORAGE_KEYS.PAYMENTS, updatedPayments);
        }

        // Repair Attendance
        const attendance = this.getAttendance();
        let attendanceChanged = false;
        const updatedAttendance = attendance.map(a => {
          const match = repairs.find(r => r.oldId === a.studentId && r.name === a.studentName);
          if (match) {
            attendanceChanged = true;
            const newKey = `${match.newId}_${a.date}`;
            return { ...a, studentId: match.newId, id: newKey };
          }
          return a;
        });
        if (attendanceChanged) {
          this.set(STORAGE_KEYS.ATTENDANCE, updatedAttendance);
        }

        // Repair ExamScores
        const examScores = this.getExamScores();
        let examScoresChanged = false;
        const updatedExamScores = examScores.map(es => {
          const match = repairs.find(r => r.oldId === es.studentId && r.name === es.studentName);
          if (match) {
            examScoresChanged = true;
            const newKey = `${es.examId}_${match.newId}`;
            return { ...es, studentId: match.newId, id: newKey };
          }
          return es;
        });
        if (examScoresChanged) {
          this.set(STORAGE_KEYS.EXAM_SCORES, updatedExamScores);
        }
      }
      this.syncGroupCounts();
    }
  }

  // Getters
  public getStudents(): Student[] {
    return this.get(STORAGE_KEYS.STUDENTS, []);
  }

  public getGroups(): Group[] {
    return this.get(STORAGE_KEYS.GROUPS, []);
  }

  public getPayments(): Payment[] {
    return this.get(STORAGE_KEYS.PAYMENTS, []);
  }

  public getAttendance(): Attendance[] {
    return this.get(STORAGE_KEYS.ATTENDANCE, []);
  }

  public getExams(): Exam[] {
    return this.get(STORAGE_KEYS.EXAMS, []);
  }

  public getExamScores(): ExamScore[] {
    return this.get(STORAGE_KEYS.EXAM_SCORES, []);
  }

  public getTemplates(): WhatsAppTemplate[] {
    return this.get(STORAGE_KEYS.WHATSAPP_TEMPLATES, []);
  }

  public getPrices(): Record<GradeType, number> {
    return this.get(STORAGE_KEYS.GRADE_PRICES, DEFAULT_GRADE_PRICES);
  }

  // Setters / Replacers
  public setStudents(students: Student[]): void {
    this.set(STORAGE_KEYS.STUDENTS, students);
    this.syncGroupCounts();
  }

  public setGroups(groups: Group[]): void {
    this.set(STORAGE_KEYS.GROUPS, groups);
  }

  public setPayments(payments: Payment[]): void {
    this.set(STORAGE_KEYS.PAYMENTS, payments);
  }

  public setAttendance(attendance: Attendance[]): void {
    this.set(STORAGE_KEYS.ATTENDANCE, attendance);
  }

  public setExams(exams: Exam[]): void {
    this.set(STORAGE_KEYS.EXAMS, exams);
  }

  public setExamScores(scores: ExamScore[]): void {
    this.set(STORAGE_KEYS.EXAM_SCORES, scores);
  }

  public setTemplates(templates: WhatsAppTemplate[]): void {
    this.set(STORAGE_KEYS.WHATSAPP_TEMPLATES, templates);
  }

  public setPrices(prices: Record<GradeType, number>): void {
    this.set(STORAGE_KEYS.GRADE_PRICES, prices);
  }

  // Auto-sync current student count per group
  private syncGroupCounts() {
    const students = this.getStudents().filter(s => s.status === 'approved');
    const groups = this.getGroups();
    
    const updatedGroups = groups.map(g => {
      const count = students.filter(s => s.groupId === g.id).length;
      return { ...g, currentCount: count };
    });
    
    this.set(STORAGE_KEYS.GROUPS, updatedGroups);
  }

  // Business Logic operations helper
  public addStudent(studentData: Omit<Student, 'id' | 'code' | 'createdAt'>): Student {
    const students = this.getStudents();
    
    // Generate sequential S code based on grade
    const gradeIndex = students.length + 1001;
    const code = `S-${gradeIndex}`;
    
    let uniqueId = `s_${Date.now()}`;
    let counter = 0;
    while (students.some(s => s.id === uniqueId)) {
      counter++;
      uniqueId = `s_${Date.now()}_${counter}`;
    }
    
    const newStudent: Student = {
      ...studentData,
      id: uniqueId,
      code,
      createdAt: new Date().toISOString()
    };
    
    students.push(newStudent);
    this.setStudents(students);
    return newStudent;
  }

  public updateStudentStatus(id: string, status: 'approved' | 'rejected'): void {
    const students = this.getStudents();
    const updated = students.map(s => {
      if (s.id === id) {
        return { ...s, status };
      }
      return s;
    });
    this.setStudents(updated);
  }

  public deleteStudent(id: string): void {
    const students = this.getStudents().filter(s => s.id !== id);
    this.setStudents(students);
  }

  public updateStudent(student: Student): void {
    const students = this.getStudents().map(s => s.id === student.id ? student : s);
    this.setStudents(students);
  }

  public addGroup(groupData: Omit<Group, 'id' | 'currentCount'>): Group {
    const groups = this.getGroups();
    let uniqueId = `g_${Date.now()}`;
    let counter = 0;
    while (groups.some(g => g.id === uniqueId)) {
      counter++;
      uniqueId = `g_${Date.now()}_${counter}`;
    }
    const newGroup: Group = {
      ...groupData,
      id: uniqueId,
      currentCount: 0
    };
    groups.push(newGroup);
    this.setGroups(groups);
    return newGroup;
  }

  public deleteGroup(id: string): void {
    const groups = this.getGroups().filter(g => g.id !== id);
    this.setGroups(groups);
  }

  public updateGroup(group: Group): void {
    const groups = this.getGroups().map(g => g.id === group.id ? group : g);
    this.setGroups(groups);
  }

  public addPayment(paymentData: Omit<Payment, 'id'>): Payment {
    const payments = this.getPayments();
    let uniqueId = `p_${Date.now()}`;
    let counter = 0;
    while (payments.some(p => p.id === uniqueId)) {
      counter++;
      uniqueId = `p_${Date.now()}_${counter}`;
    }
    const newPayment: Payment = {
      ...paymentData,
      id: uniqueId
    };
    payments.push(newPayment);
    this.setPayments(payments);
    return newPayment;
  }

  public deletePayment(id: string): void {
    const payments = this.getPayments().filter(p => p.id !== id);
    this.setPayments(payments);
  }

  public addAttendance(record: Attendance): void {
    const list = this.getAttendance();
    const key = `${record.studentId}_${record.date}`;
    const idx = list.findIndex(r => r.id === key || (r.studentId === record.studentId && r.date === record.date));
    
    const entry: Attendance = {
      ...record,
      id: key
    };
    
    if (idx !== -1) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    this.setAttendance(list);
  }

  public addExam(examData: Omit<Exam, 'id'>): Exam {
    const exams = this.getExams();
    let uniqueId = `e_${Date.now()}`;
    let counter = 0;
    while (exams.some(e => e.id === uniqueId)) {
      counter++;
      uniqueId = `e_${Date.now()}_${counter}`;
    }
    const newExam: Exam = {
      ...examData,
      id: uniqueId
    };
    exams.push(newExam);
    this.setExams(exams);
    return newExam;
  }

  public deleteExam(id: string): void {
    const exams = this.getExams().filter(e => e.id !== id);
    this.setExams(exams);
    // clean scores
    const scores = this.getExamScores().filter(s => s.examId !== id);
    this.setExamScores(scores);
  }

  public addExamScore(scoreData: ExamScore): void {
    const scores = this.getExamScores();
    const key = `${scoreData.examId}_${scoreData.studentId}`;
    const idx = scores.findIndex(s => s.id === key || (s.examId === scoreData.examId && s.studentId === scoreData.studentId));
    
    const entry = {
      ...scoreData,
      id: key
    };
    
    if (idx !== -1) {
      scores[idx] = entry;
    } else {
      scores.push(entry);
    }
    this.setExamScores(scores);
  }

  // Backup and Restore
  public exportDataJSON(): string {
    const data = {
      students: this.getStudents(),
      groups: this.getGroups(),
      payments: this.getPayments(),
      attendance: this.getAttendance(),
      exams: this.getExams(),
      examScores: this.getExamScores(),
      templates: this.getTemplates(),
      prices: this.getPrices(),
      version: '1.0.0',
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  public importDataJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.students) this.setStudents(parsed.students);
      if (parsed.groups) this.setGroups(parsed.groups);
      if (parsed.payments) this.setPayments(parsed.payments);
      if (parsed.attendance) this.setAttendance(parsed.attendance);
      if (parsed.exams) this.setExams(parsed.exams);
      if (parsed.examScores) this.setExamScores(parsed.examScores);
      if (parsed.templates) this.setTemplates(parsed.templates);
      if (parsed.prices) this.setPrices(parsed.prices);
      return true;
    } catch (e) {
      console.error('Import failure', e);
      return false;
    }
  }
}

export const dbEngine = new LocalDatabase();
