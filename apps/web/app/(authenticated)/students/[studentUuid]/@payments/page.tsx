import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { notFound } from 'next/navigation';
import PaymentsTable from './_payments-table';

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const { studentUuid } = await params;
  const { user } = await getSession();

  const student = await prisma.student.findUnique({
    where: { uuid: studentUuid, userId: user.id, deletedAt: null },
    select: { id: true },
  });


  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      title: true,
      createdAt: true,
      payment: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paidAt: true,
          notes: true,
          deletedAt: true,
        },
      },
    },
    where: {
      studentId: student.id,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // 삭제된 payment는 null로 처리
  const processedLessons = lessons.map((lesson) => ({
    ...lesson,
    payment: lesson.payment?.deletedAt ? null : lesson.payment,
  }));

  return <PaymentsTable lessons={processedLessons} />;
}
