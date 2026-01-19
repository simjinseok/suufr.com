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
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;

  const currentDate = new Date();
  const [
    currentActiveStudentCount,
    notPaidLessons,
    leftStudentsCount,
  ] = await Promise.all([
    prisma.student.count({
      where: {
        organizationId: organization.id,
        deletedAt: null,
        status: 'active',
      },
    }),
    prisma.lesson.findMany({
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
      where: {
        student: {
          organizationId: organization.id,
        },
        deletedAt: null,
        OR: [
          { payment: null },
          { payment: { deletedAt: { not: null } } },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
    prisma.studentStatus.count({
      where: {
        student: {
          organizationId: organization.id,
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
        <NotCheckedMeetings organizationId={organization.id} />
      </React.Suspense>
    </div>
  );
}

async function NotCheckedMeetings({ organizationId }: { organizationId: number }) {
  const meetings = await prisma.meeting.findMany({
    where: {
      isDone: false,
      deletedAt: null,
      organizationId,
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
