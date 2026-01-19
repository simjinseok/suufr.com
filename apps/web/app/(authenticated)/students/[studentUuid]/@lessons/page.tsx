import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/actions/settings';
import { notFound } from 'next/navigation';

import Lessons from './_lessons';

const PAGE_SIZE = 20;
export default async function LessonsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { user, organization } = session;
  const settings = await getUserSettings(user.id);
  const { studentUuid } = await params;

  const student = await prisma.student.findUnique({
    where: { uuid: studentUuid, organizationId: organization.id, deletedAt: null },
    select: { id: true },
  });

  const page = 1;
  const lessons = await prisma.lesson.findMany({
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
      sessions: {
        select: {
          id: true,
          notes: true,
          sessionAt: true,
          duration: true,
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
          sessionAt: 'asc',
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
      studentId: student.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return <Lessons lessons={lessons} use24HourFormat={settings.use24HourFormat} />;
}
