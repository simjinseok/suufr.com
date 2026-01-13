import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';

import Lessons from './_lessons';

const PAGE_SIZE = 20;
export default async function LessonsPage(props: PageProps<'/students/[studentId]'>) {
  const { user } = await getSession();
  const { studentId } = await props.params;

  const page = 1;
  const lessons = await prisma.syllabus.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      notes: true,
      student: {
        select: {
          id: true,
          name: true,
        },
      },
      lessons: {
        select: {
          id: true,
          notes: true,
          lessonAt: true,
          isDone: true,
          feedback: {
            select: {
              id: true,
              notes: true,
            },
            where: {
              deletedAt: null,
            },
          },
        },
        where: {
          deletedAt: null,
        },
        orderBy: {
          lessonAt: 'asc',
        },
      },
      payment: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paidAt: true,
          notes: true,
        },
        where: {
          deletedAt: null,
        },
      },
      shares: {
        select: {
          id: true,
          shareId: true,
          expiresAt: true,
        },
        where: {
          deletedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    where: {
      deletedAt: null,
      student: {
        id: Number(studentId),
        userId: user.id,
        deletedAt: null,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return <Lessons lessons={lessons} />;
}
