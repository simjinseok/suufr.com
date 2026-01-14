import prisma from '@/utils/prisma';
import { notFound } from 'next/navigation';
import SyllabusView from './_syllabus-view';

export const dynamic = 'force-dynamic';

export default async function SharedSyllabusPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  const share = await prisma.lessonShare.findUnique({
    where: {
      shareId,
      deletedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      syllabus: {
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
          lessons: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              lessonAt: 'asc',
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

  if (!share || !share.syllabus) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <header className="mb-6">
          <p className="text-lg font-bold text-gray-900">{share.syllabus.student?.name} 레슨</p>
          {/*<h1 className="text-2xl font-bold text-gray-900">*/}
          {/*  {share.syllabus.title}*/}
          {/*</h1>*/}
        </header>

        <SyllabusView syllabus={share.syllabus} />

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
