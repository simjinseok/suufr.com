import prisma from '@/utils/prisma';
import { notFound } from 'next/navigation';
import LessonView from './_lesson-view';

export const dynamic = 'force-dynamic';

export default async function SharedLessonPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  const share = await prisma.sessionShare.findUnique({
    where: {
      shareId,
      deletedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      lesson: {
        include: {
          student: {
            select: {
              name: true,
            },
          },
          payment: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
            },
          },
          sessions: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              sessionAt: 'asc',
            },
            include: {
              feedback: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!share || !share.lesson) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <header className="mb-6">
          <p className="text-lg font-bold text-gray-900">{share.lesson.student?.name} 레슨</p>
          {/*<h1 className="text-2xl font-bold text-gray-900">*/}
          {/*  {share.lesson.title}*/}
          {/*</h1>*/}
        </header>

        <LessonView lesson={share.lesson} />

        <footer className="mt-8 text-center text-sm text-gray-400">
          <p>
            이 링크는{' '}
            {new Date(share.expiresAt).toLocaleDateString('ko-KR')}까지
            유효합니다.
          </p>
        </footer>
      </div>
    </div>
  );
}
