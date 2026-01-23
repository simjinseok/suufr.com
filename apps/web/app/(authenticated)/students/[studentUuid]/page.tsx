import { notFound } from 'next/navigation';

import Student from './_student';
import StatsCards from './_stats-cards';
import { getSession } from '@/utils/auth';
import { studentsApi, studentStatusesApi } from '@/utils/api';

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

  const stats = {
    ...statsResult.data,
    nextPaymentAt: student.nextPaymentAt,
  };

  return (
    <>
      <Student student={student} statuses={statusesResult.data} />
      <StatsCards stats={stats} />
    </>
  );
}
