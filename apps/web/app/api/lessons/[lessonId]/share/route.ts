import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { generateShareId } from '@/utils/share-id';

// 공유 링크 생성
export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId: _lessonId } = await params;
  const lessonId = Number(_lessonId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  // 본인 소유 lesson인지 확인
  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      student: {
        userId: session.user.id,
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  const formData = await request.formData();
  const expireDays = Number(formData.get('expireDays') || 7);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expireDays);

  // 기존 활성 공유 링크 무효화
  await prisma.sessionShare.updateMany({
    where: {
      lessonId: lesson.id,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  // 새 공유 링크 생성
  const share = await prisma.sessionShare.create({
    data: {
      shareId: generateShareId(lesson.id),
      lessonId: lesson.id,
      expiresAt,
    },
  });

  return Response.json(
    {
      shareId: share.shareId,
      expiresAt: share.expiresAt,
    },
    { status: 201 },
  );
}

// 현재 공유 상태 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId: _lessonId } = await params;
  const lessonId = Number(_lessonId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      student: {
        userId: session.user.id,
      },
    },
    include: {
      shares: {
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
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  const activeShare = lesson.shares[0] || null;

  return Response.json({
    hasActiveShare: !!activeShare,
    share: activeShare
      ? {
          shareId: activeShare.shareId,
          expiresAt: activeShare.expiresAt,
          url: `https://suufr.com/sl/${activeShare.shareId}`,
        }
      : null,
  });
}

// 공유 링크 무효화
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  const { lessonId: _lessonId } = await params;
  const lessonId = Number(_lessonId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: {
      id: lessonId,
      deletedAt: null,
      student: {
        userId: session.user.id,
      },
    },
  });

  if (!lesson) {
    return new Response('', { status: 404 });
  }

  await prisma.sessionShare.updateMany({
    where: {
      lessonId: lesson.id,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  return new Response(null, { status: 204 });
}
