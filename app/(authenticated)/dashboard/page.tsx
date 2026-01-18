import prisma from '@/utils/prisma';
import { format } from 'date-fns/format';

import * as React from 'react';
import { Heading } from '@/components/heading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { getSession } from '@/utils/auth';
import DashboardCards from './_dashboard-cards';

export default async function Page() {
  const { user } = await getSession();

  const currentDate = new Date();
  const [
    currentActiveStudentCount,
    notPaidLessons,
    leftStudentsCount,
  ] = await Promise.all([
    prisma.student.count({
      where: {
        userId: user.id,
        deletedAt: null,
        status: 'active',
      },
    }),
    prisma.lesson.findMany({
      select: {
        id: true,
        title: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      where: {
        student: {
          userId: user.id,
        },
        deletedAt: null,
        OR: [
          { payment: null },
          { payment: { deletedAt: { not: null } } },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.studentStatus.count({
      where: {
        student: {
          userId: user.id,
          deletedAt: null,
        },
        status: 'leave',
        changedAt: {
          gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
          lt: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
        },
      },
    }),
  ]);
  return (
    <div>
      <DashboardCards
        currentActiveStudentCount={currentActiveStudentCount}
        leftStudentsCount={leftStudentsCount}
        notPaidLessons={notPaidLessons}
      />

      <React.Suspense>
        <NotCheckedMeetings user={user} />
      </React.Suspense>
    </div>
  );
}

async function NotCheckedMeetings({ user }: any) {
  const meetings = await prisma.meeting.findMany({
    where: {
      isDone: false,
      deletedAt: null,
      userId: user.id,
    },
    orderBy: {
      meetingAt: 'asc',
    },
  });

  if (meetings.length < 1) {
    return null;
  }

  return (
    <div className="mt-12">
      <Heading>연락이 필요한 상담내역</Heading>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>날짜</TableHeader>
            <TableHeader>이름</TableHeader>
            <TableHeader>연락처</TableHeader>
            <TableHeader>내용</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {meetings.map(meeting => (
            <TableRow key={`meeting-${meeting.id}`}>
              <TableCell>{format(meeting.meetingAt, 'yyyy-MM-dd')}</TableCell>
              <TableCell>{meeting.name}</TableCell>
              <TableCell>{meeting.phone}</TableCell>
              <TableCell className="whitespace-pre-wrap">
                {meeting.notes}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
