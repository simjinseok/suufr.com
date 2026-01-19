import type { MonthlyPaymentStats, YearlyPaymentStats } from '@/types/index';

type PaymentWithStudent = {
  amount: number;
  paidAt: Date;
  lesson: {
    student: {
      id: number;
      name: string;
    };
  };
};

export function groupPaymentsByMonth(payments: PaymentWithStudent[]): MonthlyPaymentStats[] {
  const grouped = new Map<string, MonthlyPaymentStats>();

  for (const payment of payments) {
    const date = new Date(payment.paidAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        year,
        month,
        count: 0,
        totalAmount: 0,
        students: [],
      });
    }

    const stats = grouped.get(key)!;
    stats.count++;
    stats.totalAmount += payment.amount;

    let studentStat = stats.students.find(
      (s: { id: number }) => s.id === payment.lesson.student.id
    );
    if (!studentStat) {
      studentStat = {
        id: payment.lesson.student.id,
        name: payment.lesson.student.name,
        count: 0,
        totalAmount: 0,
      };
      stats.students.push(studentStat);
    }
    studentStat.count++;
    studentStat.totalAmount += payment.amount;
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export function groupPaymentsByYear(payments: PaymentWithStudent[]): YearlyPaymentStats[] {
  const monthlyStats = groupPaymentsByMonth(payments);
  const grouped = new Map<number, YearlyPaymentStats>();

  for (const monthly of monthlyStats) {
    if (!grouped.has(monthly.year)) {
      grouped.set(monthly.year, {
        year: monthly.year,
        count: 0,
        totalAmount: 0,
        months: [],
        students: [],
      });
    }

    const stats = grouped.get(monthly.year)!;
    stats.count += monthly.count;
    stats.totalAmount += monthly.totalAmount;
    stats.months.push(monthly);

    for (const student of monthly.students) {
      let studentStat = stats.students.find((s: { id: number }) => s.id === student.id);
      if (!studentStat) {
        studentStat = {
          id: student.id,
          name: student.name,
          count: 0,
          totalAmount: 0,
        };
        stats.students.push(studentStat);
      }
      studentStat.count += student.count;
      studentStat.totalAmount += student.totalAmount;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.year - a.year);
}

export function getMonthRange(dateStr: string | undefined): { from: Date; to: Date } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (dateStr) {
    const [y, m] = dateStr.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m)) {
      year = y;
      month = m - 1;
    }
  }

  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return { from, to };
}

export function getYearRange(dateStr: string | undefined): { from: Date; to: Date } {
  const now = new Date();
  let year = now.getFullYear();

  if (dateStr) {
    const y = parseInt(dateStr, 10);
    if (!isNaN(y)) {
      year = y;
    }
  }

  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59, 999);

  return { from, to };
}

export function formatMonthDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatYearDate(year: number): string {
  return String(year);
}

export function getPrevMonth(dateStr: string | undefined): string {
  const { from } = getMonthRange(dateStr);
  const prev = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  return formatMonthDate(prev.getFullYear(), prev.getMonth() + 1);
}

export function getNextMonth(dateStr: string | undefined): string {
  const { from } = getMonthRange(dateStr);
  const next = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return formatMonthDate(next.getFullYear(), next.getMonth() + 1);
}

export function getPrevYear(dateStr: string | undefined): string {
  const { from } = getYearRange(dateStr);
  return formatYearDate(from.getFullYear() - 1);
}

export function getNextYear(dateStr: string | undefined): string {
  const { from } = getYearRange(dateStr);
  return formatYearDate(from.getFullYear() + 1);
}

export function getCurrentMonthDate(): string {
  const now = new Date();
  return formatMonthDate(now.getFullYear(), now.getMonth() + 1);
}

export function getCurrentYearDate(): string {
  return formatYearDate(new Date().getFullYear());
}
