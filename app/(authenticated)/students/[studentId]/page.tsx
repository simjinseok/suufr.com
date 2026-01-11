import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import { notFound, redirect } from 'next/navigation';
// import { Tabs } from '@heroui/react';
import * as React from 'react';

import Student from './_student';
import StatsCards from './_stats-cards';
import Timeline from './_timeline';
import LessonsTable from './_lessons-table';
import PaymentsTable from './_payments-table';
import { getSession } from '@/utils/auth';

export default async function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user } = await getSession();

  const student = await prisma.student.findUnique({
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
    },
    where: {
      id: Number(studentId),
      userId: user.id,
    },
  });

  if (!student) {
    return notFound();
  }

  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      lessonAt: true,
      isDone: true,
      notes: true,
      feedback: {
        select: {
          id: true,
          notes: true,
        },
      },
      syllabus: {
        select: {
          title: true,
        },
      },
    },
    where: {
      syllabus: {
        studentId: student.id,
      },
      deletedAt: null,
    },
    orderBy: {
      lessonAt: 'desc',
    },
  });

  const stats = {
    totalLessons: lessons.length,
    completedLessons: lessons.filter(l => l.isDone).length,
    upcomingLessons: lessons.filter(l => !l.isDone).length,
  };

  const comments = await prisma.studentComment.findMany({
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
    where: {
      studentId: student.id,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const statusHistories = await prisma.studentStatusHistory.findMany({
    select: {
      id: true,
      changedAt: true,
      status: true,
      notes: true,
    },
    where: {
      studentId: student.id,
      deletedAt: null,
    },
    orderBy: {
      changedAt: 'desc',
    },
  });

  const payments = await prisma.payment.findMany({
    select: {
      id: true,
      amount: true,
      paymentMethod: true,
      paidAt: true,
      notes: true,
      syllabus: {
        select: {
          title: true,
        },
      },
    },
    where: {
      syllabus: {
        studentId: student.id,
      },
      deletedAt: null,
    },
    orderBy: {
      paidAt: 'desc',
    },
  });

  return (
    <div>
      <Student student={student} />

      <StatsCards stats={stats} />

      {/*<Tabs>*/}
      {/*  <Tabs.ListContainer>*/}
      {/*    <Tabs.List>*/}
      {/*      <Tabs.Tab id="timeline">*/}
      {/*        타임라인*/}
      {/*        <Tabs.Indicator />*/}
      {/*      </Tabs.Tab>*/}
      {/*      <Tabs.Tab id="lessons">*/}
      {/*        수업내역*/}
      {/*        <Tabs.Indicator />*/}
      {/*      </Tabs.Tab>*/}
      {/*      <Tabs.Tab id="payments">*/}
      {/*        입금내역*/}
      {/*        <Tabs.Indicator />*/}
      {/*      </Tabs.Tab>*/}
      {/*    </Tabs.List>*/}
      {/*  </Tabs.ListContainer>*/}

      {/*  <Tabs.Panel id="timeline">*/}
      {/*    <Timeline comments={comments} statusHistories={statusHistories} />*/}
      {/*  </Tabs.Panel>*/}

      {/*  <Tabs.Panel id="lessons">*/}
      {/*    <LessonsTable lessons={lessons} />*/}
      {/*  </Tabs.Panel>*/}

      {/*  <Tabs.Panel id="payments">*/}
      {/*    <PaymentsTable payments={payments} />*/}
      {/*  </Tabs.Panel>*/}
      {/*</Tabs>*/}
    </div>
  );
}
