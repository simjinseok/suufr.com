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
  remainingLessonsCount: number;
  completedSyllabusCount: number;
  unpaidSyllabusCount: number;
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
      CAST(COUNT(l.id) FILTER (
        WHERE l.is_done = false AND l.deleted_at IS NULL
      ) AS INT) AS "remainingLessonsCount",
      CAST(COUNT(DISTINCT syl.id) FILTER (
        WHERE syl.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM lessons l2
          WHERE l2.syllabus_id = syl.id
          AND l2.deleted_at IS NULL
          AND l2.is_done = false
        )
      ) AS INT) AS "completedSyllabusCount",
      CAST(COUNT(DISTINCT syl.id) FILTER (
        WHERE syl.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.syllabus_id = syl.id
          AND p.deleted_at IS NULL
        )
      ) AS INT) AS "unpaidSyllabusCount"
    FROM students s
    LEFT JOIN syllabuses syl ON syl.student_id = s.id
    LEFT JOIN lessons l ON l.syllabus_id = syl.id
    WHERE s.id = ${Number(studentId)}
      AND s.user_id = ${user.id}::uuid
      AND s.deleted_at IS NULL
    GROUP BY s.id, s.name, s.status, s.notes
  `;

  if (!student) {
    return notFound();
  }

  const stats = {
    remainingLessonsCount: student.remainingLessonsCount,
    completedSyllabusCount: student.completedSyllabusCount,
    unpaidSyllabusCount: student.unpaidSyllabusCount,
  };

  return (
    <>
      <Student student={student} />
      <StatsCards stats={stats} />
    </>
  );
}
