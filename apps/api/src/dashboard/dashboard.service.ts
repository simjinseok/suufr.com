import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { zonedDayStart, zonedMonthStart, zonedParts } from '../common/utils/timezone';
import { getStudentBalances } from '../common/utils/student-balance';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async getDashboardData(userId: string, explicitTimezone?: string) {
    const timezone = await this.settingsService.resolveTimezone(userId, explicitTimezone);
    // 사용자가 소유한 모든 organization 조회
    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    const organizationIds = organizations.map(o => o.id);

    // 사용자가 소유한 organization이 없으면 빈 결과 반환
    if (organizationIds.length === 0) {
      return {
        success: true,
        data: {
          activeStudentCount: 0,
          unpaidStudents: [],
          unpaidStudentsCount: 0,
          needsPriceInvoices: [],
          leftStudentsCount: 0,
          uncheckedMeetings: [],
          uncheckedMeetingsCount: 0,
          todayRemainingSessionCount: 0,
        },
      };
    }

    // 이번 달 범위 (요청 타임존 기준, 다음 달 시작을 exclusive 상한으로)
    const { year, month, day } = zonedParts(new Date(), timezone);
    const startOfMonth = zonedMonthStart(year, month, timezone);
    const endOfMonth = zonedMonthStart(year, month + 1, timezone);

    // 오늘 범위 (요청 타임존 기준, 내일 시작을 exclusive 상한으로)
    const startOfToday = zonedDayStart(year, month, day, timezone);
    const endOfToday = zonedDayStart(year, month, day + 1, timezone);

    const [activeStudentCount, students, needsPriceInvoices, leftStudentsCount, uncheckedMeetings, todayRemainingSessionCount] = await Promise.all([
      // 1. Active student count
      this.prisma.student.count({
        where: {
          deletedAt: null,
          status: 'active',
          organizationId: { in: organizationIds },
        },
      }),

      // 2. 미수 후보 — 납부 상태는 학생 단위 잔액으로 파생(§3)하므로 학생 목록을 가져와 아래에서 판정
      this.prisma.student.findMany({
        where: {
          deletedAt: null,
          organizationId: { in: organizationIds },
        },
        select: {
          id: true,
          uuid: true,
          name: true,
        },
      }),

      // 2-1. "금액 미입력" 청구(price=0) — 잔액에 잡히지 않으므로 별도 노출해 수동 수정 유도
      this.prisma.invoice.findMany({
        where: {
          price: 0,
          deletedAt: null,
          student: {
            deletedAt: null,
            organizationId: { in: organizationIds },
          },
        },
        select: {
          uuid: true,
          title: true,
          periodStart: true,
          periodEnd: true,
          createdAt: true,
          student: {
            select: {
              uuid: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 3. Left students count (this month)
      this.prisma.studentStatus.count({
        where: {
          status: 'leave',
          changedAt: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
          deletedAt: null,
          student: {
            deletedAt: null,
            organizationId: { in: organizationIds },
          },
        },
      }),

      // 4. Unchecked meetings
      this.prisma.meeting.findMany({
        where: {
          isDone: false,
          deletedAt: null,
          organizationId: { in: organizationIds },
        },
        select: {
          uuid: true,
          name: true,
          phone: true,
          notes: true,
          meetingAt: true,
        },
        orderBy: { meetingAt: 'asc' },
      }),

      // 5. 오늘 남은 수업 수 — 요청 타임존의 오늘 범위에서 완료 처리(isDone)되지 않은 세션
      this.prisma.session.count({
        where: {
          isDone: false,
          deletedAt: null,
          sessionAt: {
            gte: startOfToday,
            lt: endOfToday,
          },
          student: {
            deletedAt: null,
            organizationId: { in: organizationIds },
          },
        },
      }),
    ]);

    // 미수 판정: 학생 단위 잔액 — 미수액 = max(Σprice − Σ양수입금, 0).
    // 환불(음수)은 "돌려준 돈"이지 "안 낸 돈"이 아니므로 미수 판정에서 제외 (§6-17의 학생 레벨 이식)
    const balances = await getStudentBalances(this.prisma, students.map(s => s.id));
    const unpaidStudents = students
      .map(student => ({
        uuid: student.uuid,
        name: student.name,
        outstandingAmount: balances.get(student.id)?.outstandingAmount ?? 0,
      }))
      .filter(s => s.outstandingAmount > 0)
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount);

    return {
      success: true,
      data: {
        activeStudentCount,
        unpaidStudents,
        unpaidStudentsCount: unpaidStudents.length,
        needsPriceInvoices,
        leftStudentsCount,
        uncheckedMeetings,
        uncheckedMeetingsCount: uncheckedMeetings.length,
        todayRemainingSessionCount,
      },
    };
  }
}
