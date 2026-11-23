import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { zonedDayStart, zonedMonthStart, zonedParts } from '../common/utils/timezone';
import { SettingsService } from '../settings/settings.service';
import { buildMonthMatrix } from './month-matrix';

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
          unpaidInvoices: [],
          unpaidInvoicesCount: 0,
          leftStudentsCount: 0,
          uncheckedMeetings: [],
          uncheckedMeetingsCount: 0,
          todayRemainingSessionCount: 0,
          todaySessions: [],
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

    const [
      activeStudentCount,
      unpaidInvoices,
      leftStudentsCount,
      uncheckedMeetings,
      todayRemainingSessionCount,
      todaySessions,
    ] = await Promise.all([
      // 1. Active student count
      this.prisma.student.count({
        where: {
          deletedAt: null,
          status: 'active',
          organizationId: { in: organizationIds },
        },
      }),

      // 2. 미납 수강권 — 연결된 미삭제 입금이 1건도 없는 수강권 (§6-22 연결 기준, 금액 파생 아님).
      //    0원 수강권은 제외(체험·서비스 성격), 미래 수강권은 포함("곧 받을 돈"), 학생은 active/pending만.
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          price: { gt: 0 },
          student: {
            deletedAt: null,
            status: { in: ['active', 'pending'] },
            organizationId: { in: organizationIds },
          },
          invoicePayments: { none: { payment: { deletedAt: null } } },
        },
        select: {
          uuid: true,
          title: true,
          price: true,
          periodStart: true,
          periodEnd: true,
          student: { select: { uuid: true, name: true } },
        },
        // 오래 밀린 것부터 위로. 같은 시작일이면 생성순으로 안정 정렬
        orderBy: [
          { periodStart: 'asc' },
          { createdAt: 'asc' },
        ],
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

      // 5. 오늘 남은 수업 수 — 요청 타임존의 오늘 범위에서 아직 예정인 세션
      this.prisma.session.count({
        where: {
          status: 'scheduled',
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

      // 6. 오늘 수업 목록 — 메인 "오늘 수업" 막대용. 완료 여부는 시각이 아니라 status로 판단
      this.prisma.session.findMany({
        where: {
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
        select: {
          uuid: true,
          sessionAt: true,
          duration: true,
          status: true,
          student: { select: { uuid: true, name: true } },
        },
        orderBy: { sessionAt: 'asc' },
      }),
    ]);

    return {
      success: true,
      data: {
        activeStudentCount,
        unpaidInvoices,
        unpaidInvoicesCount: unpaidInvoices.length,
        leftStudentsCount,
        uncheckedMeetings,
        uncheckedMeetingsCount: uncheckedMeetings.length,
        todayRemainingSessionCount,
        todaySessions,
      },
    };
  }

  /**
   * 메인 월 매트릭스. 행은 active 이거나 그 달에 수업이 있는 미삭제 학생
   * (그만둔 학생도 그 달 수업이 있으면 남는다).
   * @param monthParam 'YYYY-MM'. 없으면 유저 타임존의 이번 달
   */
  async getMonthMatrix(userId: string, monthParam?: string, explicitTimezone?: string) {
    const timezone = await this.settingsService.resolveTimezone(userId, explicitTimezone);
    const now = new Date();

    const { year, month } = monthParam
      ? { year: Number(monthParam.slice(0, 4)), month: Number(monthParam.slice(5, 7)) }
      : zonedParts(now, timezone);

    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    const organizationIds = organizations.map(o => o.id);

    if (organizationIds.length === 0) {
      return {
        success: true,
        data: buildMonthMatrix({ year, month, timezone, now, students: [], sessions: [], invoices: [] }),
      };
    }

    // 세션 범위 (유저 타임존 기준, 다음 달 시작을 exclusive 상한으로)
    const sessionAtRange = {
      gte: zonedMonthStart(year, month, timezone),
      lt: zonedMonthStart(year, month + 1, timezone),
    };
    // 수강권 기간은 date-only(UTC 자정 고정)라 UTC 날짜로 비교
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const lastDay = new Date(Date.UTC(year, month, 0));
    const studentScope = { deletedAt: null, organizationId: { in: organizationIds } };

    const [students, sessions, invoices] = await Promise.all([
      this.prisma.student.findMany({
        where: {
          ...studentScope,
          OR: [
            { status: 'active' },
            { sessions: { some: { deletedAt: null, sessionAt: sessionAtRange } } },
          ],
        },
        select: { uuid: true, name: true },
      }),
      this.prisma.session.findMany({
        where: {
          deletedAt: null,
          sessionAt: sessionAtRange,
          student: studentScope,
        },
        select: {
          sessionAt: true,
          status: true,
          student: { select: { uuid: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          deletedAt: null,
          student: studentScope,
          periodStart: { lte: lastDay },
          OR: [{ periodEnd: null }, { periodEnd: { gte: firstDay } }],
        },
        select: {
          periodStart: true,
          periodEnd: true,
          student: { select: { uuid: true } },
        },
        orderBy: { periodStart: 'asc' },
      }),
    ]);

    return {
      success: true,
      data: buildMonthMatrix({
        year,
        month,
        timezone,
        now,
        students,
        sessions: sessions.map(s => ({ studentUuid: s.student.uuid, sessionAt: s.sessionAt, status: s.status })),
        invoices: invoices.map(i => ({ studentUuid: i.student.uuid, periodStart: i.periodStart, periodEnd: i.periodEnd })),
      }),
    };
  }
}
