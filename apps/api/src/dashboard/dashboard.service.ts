import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(organizationId: number, memberId: number) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [activeStudentCount, notPaidLessons, leftStudentsCount, uncheckedMeetings] = await Promise.all([
      // 1. Active student count
      this.prisma.student.count({
        where: {
          organizationId,
          deletedAt: null,
          status: 'active',
        },
      }),

      // 2. Not paid lessons (lessons without payment or with deleted payment)
      this.prisma.lesson.findMany({
        where: {
          memberId,
          deletedAt: null,
          student: {
            organizationId,
            deletedAt: null,
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
            organizationId,
            deletedAt: null,
          },
        },
      }),

      // 4. Unchecked meetings
      this.prisma.meeting.findMany({
        where: {
          organizationId,
          isDone: false,
          deletedAt: null,
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
