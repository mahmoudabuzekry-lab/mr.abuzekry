/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Group, Payment, Attendance, Exam, ExamScore, WhatsAppTemplate, GradeType, ExemptionType } from './types';
import { syncEntityToFirebase, uploadBackupToFirebase, downloadBackupFromFirebase } from './firebase';

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
const INITIAL_GROUPS: Group[] = [];
const INITIAL_STUDENTS: Student[] = [];
const INITIAL_EXAMS: Exam[] = [];
const INITIAL_EXAM_SCORES: ExamScore[] = [];
const INITIAL_PAYMENTS: Payment[] = [];
const INITIAL_ATTENDANCE: Attendance[] = [];

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
    if (!localStorage.getItem('abuzekry_demo_cleared_v2')) {
      this.set(STORAGE_KEYS.GROUPS, []);
      this.set(STORAGE_KEYS.STUDENTS, []);
      this.set(STORAGE_KEYS.EXAMS, []);
      this.set(STORAGE_KEYS.EXAM_SCORES, []);
      this.set(STORAGE_KEYS.PAYMENTS, []);
      this.set(STORAGE_KEYS.ATTENDANCE, []);
      localStorage.setItem('abuzekry_demo_cleared_v2', 'true');
      
      if (this.isFirebaseEnabled()) {
        try {
          this.clearAllDemoData();
        } catch (e) {
          console.error('Failed to clear firebase demo data on migration:', e);
        }
      }
    }

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

  // Firebase configuration toggle
  public isFirebaseEnabled(): boolean {
    return localStorage.getItem('abuzekry_firebase_enabled') !== 'false';
  }

  public setFirebaseEnabled(enabled: boolean): void {
    localStorage.setItem('abuzekry_firebase_enabled', enabled ? 'true' : 'false');
  }

  public async syncAllToFirebase(): Promise<void> {
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
    await uploadBackupToFirebase(data);
    localStorage.setItem('abuzekry_last_firebase_sync', new Date().toISOString());

    // Sync separate collections for real-time fetch on client portals
    await Promise.all([
      syncEntityToFirebase('students', data.students),
      syncEntityToFirebase('groups', data.groups),
      syncEntityToFirebase('payments', data.payments),
      syncEntityToFirebase('attendance', data.attendance),
      syncEntityToFirebase('exams', data.exams),
      syncEntityToFirebase('examScores', data.examScores),
      syncEntityToFirebase('templates', data.templates),
      syncEntityToFirebase('prices', data.prices)
    ]);
  }

  public async syncAllFromFirebase(): Promise<boolean> {
    const backup = await downloadBackupFromFirebase();
    if (backup) {
      if (backup.students) this.setStudentsDirect(backup.students);
      if (backup.groups) this.setGroupsDirect(backup.groups);
      if (backup.payments) this.setPaymentsDirect(backup.payments);
      if (backup.attendance) this.setAttendanceDirect(backup.attendance);
      if (backup.exams) this.setExamsDirect(backup.exams);
      if (backup.examScores) this.setExamScoresDirect(backup.examScores);
      if (backup.templates) this.setTemplatesDirect(backup.templates);
      if (backup.prices) this.setPricesDirect(backup.prices);
      this.syncGroupCounts();
      localStorage.setItem('abuzekry_last_firebase_sync', new Date().toISOString());
      return true;
    }
    return false;
  }

  // Direct setters bypassing firebase sync to avoid loops during pull
  private setStudentsDirect(students: Student[]): void {
    this.set(STORAGE_KEYS.STUDENTS, students);
  }
  private setGroupsDirect(groups: Group[]): void {
    this.set(STORAGE_KEYS.GROUPS, groups);
  }
  private setPaymentsDirect(payments: Payment[]): void {
    this.set(STORAGE_KEYS.PAYMENTS, payments);
  }
  private setAttendanceDirect(attendance: Attendance[]): void {
    this.set(STORAGE_KEYS.ATTENDANCE, attendance);
  }
  private setExamsDirect(exams: Exam[]): void {
    this.set(STORAGE_KEYS.EXAMS, exams);
  }
  private setExamScoresDirect(scores: ExamScore[]): void {
    this.set(STORAGE_KEYS.EXAM_SCORES, scores);
  }
  private setTemplatesDirect(templates: WhatsAppTemplate[]): void {
    this.set(STORAGE_KEYS.WHATSAPP_TEMPLATES, templates);
  }
  private setPricesDirect(prices: Record<GradeType, number>): void {
    this.set(STORAGE_KEYS.GRADE_PRICES, prices);
  }

  // Setters / Replacers
  public setStudents(students: Student[]): void {
    this.set(STORAGE_KEYS.STUDENTS, students);
    this.syncGroupCounts();
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('students', students);
    }
  }

  public setGroups(groups: Group[]): void {
    this.set(STORAGE_KEYS.GROUPS, groups);
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('groups', groups);
    }
  }

  public setPayments(payments: Payment[]): void {
    this.set(STORAGE_KEYS.PAYMENTS, payments);
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('payments', payments);
    }
  }

  public setAttendance(attendance: Attendance[]): void {
    this.set(STORAGE_KEYS.ATTENDANCE, attendance);
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('attendance', attendance);
    }
  }

  public setExams(exams: Exam[]): void {
    this.set(STORAGE_KEYS.EXAMS, exams);
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('exams', exams);
    }
  }

  public setExamScores(scores: ExamScore[]): void {
    this.set(STORAGE_KEYS.EXAM_SCORES, scores);
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('examScores', scores);
    }
  }

  public setTemplates(templates: WhatsAppTemplate[]): void {
    this.set(STORAGE_KEYS.WHATSAPP_TEMPLATES, templates);
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('templates', templates);
    }
  }

  public setPrices(prices: Record<GradeType, number>): void {
    this.set(STORAGE_KEYS.GRADE_PRICES, prices);
    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('prices', prices);
    }
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

  public clearAllDemoData(): void {
    this.set(STORAGE_KEYS.STUDENTS, []);
    this.set(STORAGE_KEYS.GROUPS, []);
    this.set(STORAGE_KEYS.PAYMENTS, []);
    this.set(STORAGE_KEYS.ATTENDANCE, []);
    this.set(STORAGE_KEYS.EXAMS, []);
    this.set(STORAGE_KEYS.EXAM_SCORES, []);

    if (this.isFirebaseEnabled()) {
      syncEntityToFirebase('students', []);
      syncEntityToFirebase('groups', []);
      syncEntityToFirebase('payments', []);
      syncEntityToFirebase('attendance', []);
      syncEntityToFirebase('exams', []);
      syncEntityToFirebase('examScores', []);
      this.syncAllToFirebase().catch(err => console.error('Error syncing cleared state to firebase:', err));
    }
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
