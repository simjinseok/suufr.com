import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';
import { redirect } from 'next/navigation';

import { Card } from '@heroui/react';
import { Heading } from '@/components/heading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import React from 'react';
import { format } from 'date-fns/format';
import { BanknoteXIcon, ShapesIcon, UsersRoundIcon } from 'lucide-react';

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login');
  }

  const [
    currentActiveStudentCount,
    remainLessonsCount,
    notPaidSyllabusesCount,
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
        isDone: false,
        syllabus: {
          student: {
            userId: user.id,
          },
        },
        deletedAt: null,
      },
    }),
    prisma.syllabus.count({
      where: {
        student: {
          userId: user.id,
        },
        deletedAt: null,
        payment: null,
      },
    }),
  ]);
  return (
    <div>
      <div className="mt-3 grid grid-cols-4 gap-x-3">
        <Card className="border border-transparent dark:border-default-100">
          <div className="flex p-4">
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-success-50">
              <UsersRoundIcon className="text-success" width={20} height={20} />
            </div>
            <div className="flex flex-col gap-y-2">
              <dt className="mx-4 text-small font-medium text-default-500">수강중인 학생</dt>
              <dd className="px-4 text-2xl font-semibold text-default-700">
                {currentActiveStudentCount}
                명
              </dd>
            </div>
          </div>
        </Card>

        <Card className="border border-transparent dark:border-default-100">
          <div className="flex p-4">
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-primary-50">
              <ShapesIcon className="text-primary" width={20} height={20} />
            </div>
            <div className="flex flex-col gap-y-2">
              <dt className="mx-4 text-small font-medium text-default-500">남은 수업</dt>
              <dd className="px-4 text-2xl font-semibold text-default-700">
                {remainLessonsCount}
                회
              </dd>
            </div>
          </div>
        </Card>

        <Card className="border border-transparent dark:border-default-100">
          <div className="flex p-4">
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-danger-50">
              <BanknoteXIcon className="text-danger" width={20} height={20} />
            </div>
            <div className="flex flex-col gap-y-2">
              <dt className="mx-4 text-small font-medium text-default-500">미입금</dt>
              <dd className="px-4 text-2xl font-semibold text-default-700">
                {notPaidSyllabusesCount}
                건
              </dd>
            </div>
          </div>
        </Card>
      </div>

      <React.Suspense>
        <NotPaidSyllabuses user={user} />
      </React.Suspense>

      <React.Suspense>
        <NotCheckedMeetings user={user} />
      </React.Suspense>
    </div>
  );
}

async function NotPaidSyllabuses({ user }: any) {
  const syllabuses = await prisma.syllabus.findMany({
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

  if (syllabuses.length < 1) {
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
          {syllabuses.map(syllabus => (
            <TableRow key={`syllabus-${syllabus.id}`}>
              <TableCell>{syllabus.student.name}</TableCell>
              <TableCell>{syllabus.title}</TableCell>
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
