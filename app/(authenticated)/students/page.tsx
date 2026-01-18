import type { Student } from '@/types/index';

import prisma from '@/utils/prisma';
import { createLoader, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs/server';
function buildAssetUrl(key: string | null, folder: 'student' | 'member'): string | null {
  if (!key) return null;
  return `/assets/${folder}/${key}.webp`;
}

import Link from 'next/link';
import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import ConditionForm from './_condition-form';
import NewStudent from './_new-student';
import Students from './_students';
import { getSession } from '@/utils/auth';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const loadSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  status: parseAsStringEnum(['', 'pending', 'active', 'paused', 'leave']).withDefault('active'),
  q: parseAsString.withDefault(''),
});
export default async function Page(props: PageProps<'/students'>) {
  const { page, status, q } = await loadSearchParams(props.searchParams);

  const { user } = await getSession();

  const students: Student[] = await prisma.$queryRaw`
      SELECT students.id AS id,
             students.uuid AS uuid,
             students.name AS name,
             students.notes AS notes,
             students.status AS status,
             students.profile_image_key AS "profileImageKey",
             students.created_at AS "createdAt",
             CAST(COUNT(DISTINCT sessions.id) FILTER (WHERE sessions.is_done = false AND sessions.deleted_at IS NULL) AS INT) AS "remainingSessionsCount",
             MAX(sessions.session_at) FILTER (WHERE sessions.is_done = true AND sessions.deleted_at IS NULL) AS "lastSessionDate",
             MIN(sessions.session_at) FILTER (WHERE sessions.is_done = false AND sessions.session_at >= NOW() AND sessions.deleted_at IS NULL) AS "nextSessionDate",
             BOOL_OR(lessons.id IS NOT NULL AND lessons.deleted_at IS NULL AND NOT EXISTS (
               SELECT 1 FROM payments WHERE payments.lesson_id = lessons.id AND payments.deleted_at IS NULL
             )) AS "hasUnpaidLesson"
      FROM students
               LEFT JOIN lessons ON lessons.student_id = students.id AND lessons.deleted_at IS NULL
               LEFT JOIN sessions ON sessions.lesson_id = lessons.id
      WHERE (${status} = '' OR students.status::text = ${status})
        AND (${q} = '' OR students.name ILIKE ${'%' + q + '%'})
        AND students.user_id = ${user.id}::uuid AND students.deleted_at IS NULL
      GROUP BY students.id, students.uuid, students.name, students.notes, students.created_at, students.status
      ORDER BY students.name ASC
      OFFSET ${(page - 1) * PAGE_SIZE} LIMIT ${PAGE_SIZE};
  `;

  // profileImageKey → profileImageUrl 변환 (key는 클라이언트에 노출하지 않음)
  const studentsWithImageUrl = students.map(({ profileImageKey, ...student }) => ({
    ...student,
    profileImageUrl: buildAssetUrl(profileImageKey ?? null, 'student'),
  }));

  console.log(studentsWithImageUrl);
  const studentCount: number = await prisma.student.count({
    where: {
      deletedAt: null,
      userId: user.id,
      ...(status && { status }),
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
    },
  });

  return (
    <div className="mt-3">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">수강생 목록</h1>
        <NewStudent />
      </div>

      <div className="mt-5 flex justify-between">
        <ConditionForm currentStatus={status} />
      </div>

      <Students students={studentsWithImageUrl} />

      <div className="mt-5 flex justify-between">
        {page > 1 && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page - 1,
                status: status,
                ...(q && { q }),
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
                ...(q && { q }),
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
