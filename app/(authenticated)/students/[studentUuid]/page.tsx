import prisma from '@/utils/prisma';
import { notFound } from 'next/navigation';

import Student from './_student';
import StatsCards from './_stats-cards';
import { getSession } from '@/utils/auth';
import { StudentStatusValue } from '@prisma/client';
function buildAssetUrl(key: string | null, folder: 'student' | 'member'): string | null {
  if (!key) return null;
  return `/assets/${folder}/${key}.webp`;
}

type StudentWithStats = {
  id: number;
  uuid: string;
  name: string;
  status: StudentStatusValue;
  notes: string;
  profileImageKey: string | null;
  nextPaymentAt: Date | null;
  phone: string | null;
  email: string | null;
  remainingSessionsCount: number;
  completedLessonCount: number;
  unpaidLessonCount: number;
};

type StudentStatusType = {
  id: number;
  status: string;
  changedAt: Date;
  notes: string | null;
};

export default async function Page({ params }: { params: Promise<{ studentUuid: string }> }) {
  const { studentUuid } = await params;
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;

  const [student] = await prisma.$queryRaw<StudentWithStats[]>`
    SELECT
      s.id,
      s.uuid,
      s.name,
      s.status,
      s.notes,
      s.profile_image_key AS "profileImageKey",
      s.next_payment_at AS "nextPaymentAt",
      s.phone,
      s.email,
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
    WHERE s.uuid = ${studentUuid}::uuid
      AND s.organization_id = ${organization.id}
      AND s.deleted_at IS NULL
    GROUP BY s.id, s.uuid, s.name, s.status, s.notes, s.next_payment_at, s.phone, s.email
  `;

  if (!student) {
    return notFound();
  }

  // profileImageKey → profileImageUrl 변환 (key는 클라이언트에 노출하지 않음)
  const { profileImageKey, ...studentData } = student;
  const studentWithImageUrl = {
    ...studentData,
    profileImageUrl: buildAssetUrl(profileImageKey, 'student'),
  };

  const statuses = await prisma.studentStatus.findMany({
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
  }) as StudentStatusType[];

  const stats = {
    remainingSessionsCount: student.remainingSessionsCount,
    completedLessonCount: student.completedLessonCount,
    unpaidLessonCount: student.unpaidLessonCount,
    nextPaymentAt: student.nextPaymentAt,
  };

  return (
    <>
      <Student student={studentWithImageUrl} statuses={statuses} />
      <StatsCards stats={stats} />
    </>
  );
}
