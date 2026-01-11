import type { Student } from '@/types/index';

import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import ConditionForm from './_condition-form';
import NewStudent from './_new-student';
import Students from './_students';
import { getSession } from '@/utils/auth';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
type PageProps = {
  searchParams: {
    page: number;
    status: string;
    edit: string;
  };
};
export default async function Page({ searchParams }: PageProps) {
  const { page: _page, status: _status, edit: _edit } = await searchParams;
  const page = _page > 0 ? Number(_page) : 1;
  const status = typeof _status === 'string' ? _status : 'active';

  const { user } = await getSession();

  const students: Student[] = await prisma.$queryRaw`
      SELECT students.id AS id,
             students.name AS name,
             students.notes AS notes,
             students.status AS status,
             students.created_at AS "createdAt",
             CAST(COUNT(DISTINCT lessons.id) FILTER (WHERE lessons.is_done = true AND lessons.deleted_at IS NULL) AS INT) AS "completedSessionsCount",
             CAST(COUNT(DISTINCT lessons.id) FILTER (WHERE lessons.deleted_at IS NULL) AS INT) AS "sessionsCount",
             MAX(lessons.lesson_at) FILTER (WHERE lessons.is_done = true AND lessons.deleted_at IS NULL) AS "lastLessonDate",
             MIN(lessons.lesson_at) FILTER (WHERE lessons.is_done = false AND lessons.lesson_at >= NOW() AND lessons.deleted_at IS NULL) AS "nextLessonDate",
             BOOL_OR(syllabuses.id IS NOT NULL AND syllabuses.deleted_at IS NULL AND NOT EXISTS (
               SELECT 1 FROM payments WHERE payments.syllabus_id = syllabuses.id AND payments.deleted_at IS NULL
             )) AS "hasUnpaidLesson"
      FROM students
               LEFT JOIN syllabuses ON syllabuses.student_id = students.id AND syllabuses.deleted_at IS NULL
               LEFT JOIN lessons ON lessons.syllabus_id = syllabuses.id
      WHERE (${status} = '' OR students.status::text = ${status})
        AND students.user_id = ${user.id}::uuid AND students.deleted_at IS NULL
      GROUP BY students.id, students.name, students.notes, students.created_at, students.status
      ORDER BY students.name ASC
      OFFSET ${(page - 1) * PAGE_SIZE} LIMIT ${PAGE_SIZE};
  `;

  const studentCount: number = await prisma.student.count({
    where: {
      deletedAt: null,
      userId: user.id,
    },
  });

  return (
    <div className="mt-3">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">수강생 목록</h1>
      </div>
      <div className="mt-5 flex justify-between">
        <ConditionForm currentStatus={status} />
        <div>
          <NewStudent />
        </div>
      </div>
      <Students students={students} />
      <div className="mt-5 flex justify-between">
        {page > 1 && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page - 1,
                status: status,
              },
            }}
          >
            <ChevronLeftIcon />
            이전 페이지
          </Link>
        )}
        {(studentCount > (page * PAGE_SIZE)) && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page + 1,
                status: status,
              },
            }}
          >
            다음 페이지
            <ChevronRightIcon />
          </Link>
        )}
      </div>
    </div>
  );
}
