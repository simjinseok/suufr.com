import { notFound } from 'next/navigation';

import Student from './_student';
import StatsCards from './_stats-cards';
import { getSession } from '@/utils/auth';
import { studentsApi, studentStatusesApi } from '@/utils/api';

function buildAssetUrl(key: string | null, folder: 'student' | 'member'): string | null {
  if (!key) return null;
  return `/assets/${folder}/${key}.webp`;
}

export default async function Page({ params }: { params: Promise<{ studentUuid: string }> }) {
  const { studentUuid } = await params;
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }

  const [studentResult, statsResult, statusesResult] = await Promise.all([
    studentsApi.get(studentUuid),
    studentsApi.getStats(studentUuid),
    studentStatusesApi.listByStudent(studentUuid),
  ]);

  const student = studentResult.data;

  if (!student) {
    return notFound();
  }

  const { profileImageKey, ...studentData } = student;
  const studentWithImageUrl = {
    ...studentData,
    profileImageUrl: buildAssetUrl(profileImageKey ?? null, 'student'),
  };

  const stats = {
    ...statsResult.data,
    nextPaymentAt: student.nextPaymentAt,
  };

  return (
    <>
      <Student student={studentWithImageUrl} statuses={statusesResult.data} />
      <StatsCards stats={stats} />
    </>
  );
}
