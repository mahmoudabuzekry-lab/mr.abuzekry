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
  notes?: string;
  status: StudentStatus;
  exemptionType: ExemptionType;
  discountAmount: number; // For partial exemptions
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
  type: 'attendance' | 'absence' | 'payment_reminder' | 'exam_result' | 'announcement';
  text: string;
}

export interface GradePrice {
  grade: GradeType;
  price: number;
}
