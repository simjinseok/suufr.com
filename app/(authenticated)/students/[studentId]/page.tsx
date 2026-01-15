import prisma from '@/utils/prisma';
import { notFound } from 'next/navigation';

import Student from './_student';
import StatsCards from './_stats-cards';
import { getSession } from '@/utils/auth';
import { StudentStatus } from '@prisma/client';

type StudentWithStats = {
  id: number;
  name: string;
  status: StudentStatus;
  notes: string;
  remainingSessionsCount: number;
  completedLessonCount: number;
  unpaidLessonCount: number;
};

export default async function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user } = await getSession();

  const [student] = await prisma.$queryRaw<StudentWithStats[]>`
    SELECT
      s.id,
      s.name,
      s.status,
      s.notes,
      CAST(COUNT(sess.id) FILTER (
        WHERE sess.is_done = false AND sess.deleted_at IS NULL
      ) AS INT) AS "remainingSessionsCount",
      CAST(COUNT(DISTINCT les.id) FILTER (
        WHERE les.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM sessions sess2
          WHERE sess2.lesson_id = les.id
          AND sess2.deleted_at IS NULL
          AND sess2.is_done = false
        )
      ) AS INT) AS "completedLessonCount",
      CAST(COUNT(DISTINCT les.id) FILTER (
        WHERE les.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.lesson_id = les.id
          AND p.deleted_at IS NULL
        )
      ) AS INT) AS "unpaidLessonCount"
    FROM students s
    LEFT JOIN lessons les ON les.student_id = s.id
    LEFT JOIN sessions sess ON sess.lesson_id = les.id
    WHERE s.id = ${Number(studentId)}
      AND s.user_id = ${user.id}::uuid
      AND s.deleted_at IS NULL
    GROUP BY s.id, s.name, s.status, s.notes
  `;

  if (!student) {
    return notFound();
  }

  const stats = {
    remainingSessionsCount: student.remainingSessionsCount,
    completedLessonCount: student.completedLessonCount,
    unpaidLessonCount: student.unpaidLessonCount,
  };

  return (
    <>
      <Student student={student} />
      <StatsCards stats={stats} />
    </>
  );
}
