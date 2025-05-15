import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';
import { redirect } from 'next/navigation';

import React from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, CircleCheckBigIcon, CircleIcon } from 'lucide-react';
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/components/description-list';
import { Heading } from '@/components/heading';

import EditLesson from './_edit';
import Filter from './_filter';
import Lessons from './_lessons';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;
export default async function Page({
  searchParams,
}: {
  searchParams: { student: string; from: string; to: string; edit: string; page: string };
}) {
  const { student: _student, from: _from, to: _to, edit: _edit, page: _page } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const page = Number(_page) > 0 ? Number(_page) : 1;
  const studentId = Number(_student);
  const from = _from ? new Date(_from) : new Date(0);
  const to = _to ? new Date(_to) : new Date(2040, 1, 1);
  const where = {
    deletedAt: null,
    ...(from
      ? {
          lessonAt: {
            gte: from,
            lte: to,
          },
        }
      : {}),
    syllabus: {
      student: {
        ...(studentId ? { id: studentId } : {}),
        userId: user.id,
      },
    },
  };
  const lessons = await prisma.lesson.findMany({
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    select: {
      id: true,
      lessonAt: true,
      notes: true,
      isDone: true,
      syllabus: {
        select: {
          student: {
            select: {
              id: true,
              name: true,
              notes: true,
            },
          },
        },
      },
    },
    where,
    orderBy: {
      lessonAt: 'desc',
    },
  });

  const lessonsCount = await prisma.lesson.count({
    where,
  });

  const editingLesson = _edit
    ? lessons.find(l => l.id === Number(_edit))
    : null;

  return (
    <div>
      <Heading level={1}>수업</Heading>
      <div className="mt-6">
        <Filter />
      </div>
      {lessons.length > 0 && (
        <div className="mt-3">
          <Heading level={3}>요약</Heading>
          <DescriptionList>
            <DescriptionTerm>결제 건수</DescriptionTerm>
            <DescriptionDetails>건</DescriptionDetails>

            <DescriptionTerm>결제 금액</DescriptionTerm>
            <DescriptionDetails>
            </DescriptionDetails>
          </DescriptionList>
        </div>
      )}
      <Lessons lessons={lessons} />
      {editingLesson && (
        <EditLesson
          lesson={editingLesson}
        />
      )}
      <div className="mt-10 flex justify-between">
        <div>
          {page > 1 && (
            <Link
              className="flex items-center"
              href={{
                query: {
                  student: _student,
                  from: _from,
                  to: _to,
                  edit: _edit,
                  page: page - 1,
                },
              }}
            >
              <ChevronLeftIcon />
              이전 페이지
            </Link>
          )}
        </div>
        <div>
          {lessonsCount > page * PAGE_SIZE && (
            <Link
              className="flex items-center"
              href={{
                query: {
                  student: _student,
                  from: _from,
                  to: _to,
                  edit: _edit,
                  page: page + 1,
                },
              }}
            >
              다음 페이지
              <ChevronRightIcon />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
