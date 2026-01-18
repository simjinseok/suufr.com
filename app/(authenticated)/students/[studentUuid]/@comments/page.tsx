import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { notFound } from 'next/navigation';
import Comments from './_comments';

export default async function CommentsPage({
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

  const comments = await prisma.studentComment.findMany({
    select: {
      id: true,
      uuid: true,
      content: true,
      createdAt: true,
    },
    where: {
      studentId: student?.id,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return <Comments comments={comments} studentUuid={studentUuid} />;
}
