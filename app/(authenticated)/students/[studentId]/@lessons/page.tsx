import prisma from '@/utils/prisma';
import LessonsTable from './_lessons-table';

export default async function LessonsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      lessonAt: true,
      isDone: true,
      notes: true,
      feedback: {
        select: {
          id: true,
          notes: true,
        },
      },
      syllabus: {
        select: {
          title: true,
        },
      },
    },
    where: {
      syllabus: {
        studentId: Number(studentId),
      },
      deletedAt: null,
    },
    orderBy: {
      lessonAt: 'desc',
    },
  });

  return <LessonsTable lessons={lessons} />;
}
