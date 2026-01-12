import prisma from '@/utils/prisma';
import Timeline from './_timeline';

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const [comments, statusHistories] = await Promise.all([
    prisma.studentComment.findMany({
      select: {
        id: true,
        content: true,
        createdAt: true,
      },
      where: {
        studentId: Number(studentId),
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.studentStatusHistory.findMany({
      select: {
        id: true,
        changedAt: true,
        status: true,
        notes: true,
      },
      where: {
        studentId: Number(studentId),
        deletedAt: null,
      },
      orderBy: {
        changedAt: 'desc',
      },
    }),
  ]);

  return <Timeline comments={comments} statusHistories={statusHistories} />;
}
