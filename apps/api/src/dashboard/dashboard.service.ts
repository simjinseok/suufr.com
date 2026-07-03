import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { kstMonthStart, toKstParts } from '../common/utils/kst';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(userId: string) {
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
          notPaidLessons: [],
          notPaidLessonsCount: 0,
          leftStudentsCount: 0,
          uncheckedMeetings: [],
          uncheckedMeetingsCount: 0,
        },
      };
    }

    // 이번 달 범위 (KST 기준, 다음 달 시작을 exclusive 상한으로)
    const { year, month } = toKstParts(new Date());
    const startOfMonth = kstMonthStart(year, month);
    const endOfMonth = kstMonthStart(year, month + 1);

    const [activeStudentCount, notPaidLessons, leftStudentsCount, uncheckedMeetings] = await Promise.all([
      // 1. Active student count
      this.prisma.student.count({
        where: {
          deletedAt: null,
          status: 'active',
          organizationId: { in: organizationIds },
        },
      }),

      // 2. Not paid lessons (lessons without payment or with deleted payment)
      this.prisma.lesson.findMany({
        where: {
          deletedAt: null,
          student: {
            deletedAt: null,
            organizationId: { in: organizationIds },
          },
          OR: [
            { payment: null },
            { payment: { deletedAt: { not: null } } },
          ],
        },
        select: {
          uuid: true,
          title: true,
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
    ]);

    return {
      success: true,
      data: {
        activeStudentCount,
        notPaidLessons,
        notPaidLessonsCount: notPaidLessons.length,
        leftStudentsCount,
        uncheckedMeetings,
        uncheckedMeetingsCount: uncheckedMeetings.length,
      },
    };
  }
}
