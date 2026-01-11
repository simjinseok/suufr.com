import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';
import { redirect } from 'next/navigation';

import React from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, CircleCheckBigIcon, CircleIcon } from 'lucide-react';
import { Heading } from '@/components/heading';

import Filter from './_filter';
import Lessons from './_lessons';

const coordinateSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  from: parseAsString,
  to: parseAsString,
  studentId: parseAsInteger,
});

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;
export default async function Page(props: PageProps<'/sessions'>) {
  const { page, studentId, from: _from, to: _to } = coordinateSearchParams(await props.searchParams);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

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
        deletedAt: null,
      },
    },
  };

  const queries = [];
  queries.push(prisma.lesson.findMany({
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
  }));
  queries.push(prisma.lesson.count({
    where,
  }));
  if (studentId) {
    queries.push(prisma.student.findUnique({
      where: { id: studentId, userId: user.id, deletedAt: null },
      select: { id: true, name: true },
    }));
  }

  const [lessons, lessonsCount, student] = await Promise.all(queries);

  return (
    <div>
      <Heading level={1}>수업</Heading>
      <div className="mt-6">
        <Filter student={student} />
      </div>
      <Lessons lessons={lessons} />
      <div className="mt-10 flex justify-between">
        <div>
          {page > 1 && (
            <Link
              className="flex items-center"
              href={{
                query: {
                  studentId,
                  from: _from,
                  to: _to,
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
                  studentId,
                  from: _from,
                  to: _to,
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
