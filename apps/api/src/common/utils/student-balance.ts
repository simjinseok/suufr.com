import type { PrismaClient } from '@prisma/generated/client';

// 학생 단위 잔액 파생 (docs/schema-redesign.md §3)
// 판정은 비대칭: 미수는 양수 입금 기준(환불이 미수를 만들지 않는다),
// 선납 잔액은 전체 입금 기준(환불이 맡겨둔 돈을 줄인다).
export interface StudentBalance {
  billedTotal: number; // Σ invoice.price
  grossPaid: number; // Σ 양수 입금
  netPaid: number; // Σ 전체 입금 (환불 차감) — 실수령
  outstandingAmount: number; // 미수액 = max(billedTotal − grossPaid, 0)
  creditAmount: number; // 선납 잔액 = max(netPaid − billedTotal, 0)
}

export const EMPTY_BALANCE: StudentBalance = {
  billedTotal: 0,
  grossPaid: 0,
  netPaid: 0,
  outstandingAmount: 0,
  creditAmount: 0,
};

type Db = Pick<PrismaClient, 'invoice' | 'payment'>;

export async function getStudentBalances(
  db: Db,
  studentIds: number[],
): Promise<Map<number, StudentBalance>> {
  if (studentIds.length === 0) return new Map();

  const [billed, paidNet, paidGross] = await Promise.all([
    db.invoice.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, deletedAt: null },
      _sum: { price: true },
    }),
    db.payment.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, deletedAt: null },
      _sum: { amount: true },
    }),
    db.payment.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, deletedAt: null, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ]);

  const billedMap = new Map(billed.map(b => [b.studentId, b._sum.price ?? 0]));
  const netMap = new Map(paidNet.map(p => [p.studentId, p._sum.amount ?? 0]));
  const grossMap = new Map(paidGross.map(p => [p.studentId, p._sum.amount ?? 0]));

  const result = new Map<number, StudentBalance>();
  for (const studentId of studentIds) {
    const billedTotal = billedMap.get(studentId) ?? 0;
    const netPaid = netMap.get(studentId) ?? 0;
    const grossPaid = grossMap.get(studentId) ?? 0;
    result.set(studentId, {
      billedTotal,
      grossPaid,
      netPaid,
      outstandingAmount: Math.max(billedTotal - grossPaid, 0),
      creditAmount: Math.max(netPaid - billedTotal, 0),
    });
  }
  return result;
}
