import prisma from '@/utils/prisma';
import { format } from 'date-fns/format';

import * as React from 'react';
import { redirect } from 'next/navigation';
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

export default async function Page() {
  const { user } = await getSession();

  const currentDate = new Date();
  const [
    currentActiveStudentCount,
    notPaidLessonsCount,
    leftStudentsCount,
  ] = await Promise.all([
    prisma.student.count({
      where: {
        userId: user.id,
        deletedAt: null,
        status: 'active',
      },
    }),
    prisma.lesson.count({
      where: {
        student: {
          userId: user.id,
        },
        deletedAt: null,
        payment: null,
      },
    }),
    prisma.studentStatusHistory.count({
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
      {/* <div className="mt-3 grid grid-cols-3 gap-x-3"> */}
      {/*  <Card className="border border-transparent dark:border-default-100"> */}
      {/*    <div className="flex p-4"> */}
      {/*      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-success-50"> */}
      {/*        <UserRoundCheckIcon className="text-success" width={20} height={20} /> */}
      {/*      </div> */}
      {/*      <div className="flex flex-col gap-y-2"> */}
      {/*        <dt className="mx-4 text-small font-medium text-default-500">수강중인 학생</dt> */}
      {/*        <dd className="px-4 text-2xl font-semibold text-default-700"> */}
      {/*          {currentActiveStudentCount} */}
      {/*          명 */}
      {/*        </dd> */}
      {/*      </div> */}
      {/*    </div> */}
      {/*  </Card> */}

      {/*  <Card className="border border-transparent dark:border-default-100"> */}
      {/*    <div className="flex p-4"> */}
      {/*      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-danger-50"> */}
      {/*        <UserRoundMinusIcon className="text-danger" width={20} height={20} /> */}
      {/*      </div> */}
      {/*      <div className="flex flex-col gap-y-2"> */}
      {/*        <dt className="mx-4 text-small font-medium text-default-500">그만둔 수강생</dt> */}
      {/*        <dd className="px-4 text-2xl font-semibold text-default-700"> */}
      {/*          {leftStudentsCount} */}
      {/*          명 */}
      {/*        </dd> */}
      {/*      </div> */}
      {/*    </div> */}
      {/*  </Card> */}

      {/*  <Card className="border border-transparent dark:border-default-100"> */}
      {/*    <div className="flex p-4"> */}
      {/*      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-danger-50"> */}
      {/*        <BanknoteXIcon className="text-danger" width={20} height={20} /> */}
      {/*      </div> */}
      {/*      <div className="flex flex-col gap-y-2"> */}
      {/*        <dt className="mx-4 text-small font-medium text-default-500">미입금</dt> */}
      {/*        <dd className="px-4 text-2xl font-semibold text-default-700"> */}
      {/*          {notPaidSyllabusesCount} */}
      {/*          건 */}
      {/*        </dd> */}
      {/*      </div> */}
      {/*    </div> */}
      {/*  </Card> */}
      {/* </div> */}

      <React.Suspense>
        <NotPaidLessons user={user} />
      </React.Suspense>

      <React.Suspense>
        <NotCheckedMeetings user={user} />
      </React.Suspense>
    </div>
  );
}

async function NotPaidLessons({ user }: any) {
  const lessons = await prisma.lesson.findMany({
    include: {
      student: true,
    },
    where: {
      deletedAt: null,
      payment: null,
      student: {
        userId: user.id,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (lessons.length < 1) {
    return null;
  }

  return (
    <div className="mt-12">
      <Heading>입금 확인이 필요한 일정</Heading>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>학생명</TableHeader>
            <TableHeader>제목</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {lessons.map(lesson => (
            <TableRow key={`lesson-${lesson.id}`}>
              <TableCell>{lesson.student.name}</TableCell>
              <TableCell>{lesson.title}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
