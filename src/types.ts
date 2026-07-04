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

const ARABIC_MONTHS_MAP: { [key: string]: number } = {
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
  let targetYear = 2026;
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

  // If year is not found explicitly, infer it based on academic session (August to December -> 2025, others -> 2026)
  if (!yearFound) {
    if (targetMonth >= 8) {
      targetYear = 2025;
    } else {
      targetYear = 2026;
    }
  }
  
  const regDate = new Date(dateIsoStr);
  if (isNaN(regDate.getTime())) return false;
  
  const regYear = regDate.getFullYear();
  const regMonth = regDate.getMonth() + 1;
  
  if (targetYear < regYear) {
    return true;
  }
  if (targetYear === regYear && targetMonth < regMonth) {
    return true;
  }
  
  return false;
}

export function getCurrentArabicMonthName(): string {
  const ALL_ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthIndex = new Date().getMonth();
  return ALL_ARABIC_MONTHS[currentMonthIndex];
}


