import prisma from '@/utils/prisma';
import PaymentsTable from './_payments-table';

export default async function PaymentsPage({
                                             params,
                                           }: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

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
      studentId: Number(studentId),
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
