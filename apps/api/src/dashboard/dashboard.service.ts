import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    // 사용자가 속한 모든 organization 조회
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, deletedAt: null, organization: { deletedAt: null } },
      select: { organizationId: true, id: true },
    });

    const organizationIds = memberships.map(m => m.organizationId);
    const memberIds = memberships.map(m => m.id);

    // 사용자가 속한 organization이 없으면 빈 결과 반환
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

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

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
          memberId: { in: memberIds },
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
            lte: endOfMonth,
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
