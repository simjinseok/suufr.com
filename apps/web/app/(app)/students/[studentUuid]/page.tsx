import { notFound } from 'next/navigation';

import Student from './_student';
import { getSession } from '@/utils/auth';
import { studentsApi, studentStatusesApi } from '@/utils/api';

export default async function Page({ params }: { params: Promise<{ studentUuid: string }> }) {
  const { studentUuid } = await params;
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }

  const [studentResult, statusesResult] = await Promise.all([
    studentsApi.get(studentUuid),
    studentStatusesApi.listByStudent(studentUuid),
  ]);

  const student = studentResult.data;

  if (!student) {
    return notFound();
  }

  return <Student student={student} statuses={statusesResult.data} />;
}
