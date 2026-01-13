import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

// 공유 링크 생성
export async function POST(
  request: Request,
  { params }: { params: Promise<{ syllabusId: string }> },
) {
  const { syllabusId: _syllabusId } = await params;
  const syllabusId = Number(_syllabusId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  // 본인 소유 syllabus인지 확인
  const syllabus = await prisma.syllabus.findUnique({
    where: {
      id: syllabusId,
      deletedAt: null,
      student: {
        userId: session.user.id,
      },
    },
  });

  if (!syllabus) {
    return new Response('', { status: 404 });
  }

  const formData = await request.formData();
  const expireDays = Number(formData.get('expireDays') || 7);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expireDays);

  // 기존 활성 공유 링크 무효화
  await prisma.lessonShare.updateMany({
    where: {
      syllabusId: syllabus.id,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  // 새 공유 링크 생성
  const share = await prisma.lessonShare.create({
    data: {
      syllabusId: syllabus.id,
      expiresAt,
    },
  });

  return Response.json(
    {
      uuid: share.uuid,
      expiresAt: share.expiresAt,
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/share/${share.uuid}`,
    },
    { status: 201 },
  );
}

// 현재 공유 상태 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ syllabusId: string }> },
) {
  const { syllabusId: _syllabusId } = await params;
  const syllabusId = Number(_syllabusId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const syllabus = await prisma.syllabus.findUnique({
    where: {
      id: syllabusId,
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

  if (!syllabus) {
    return new Response('', { status: 404 });
  }

  const activeShare = syllabus.shares[0] || null;

  return Response.json({
    hasActiveShare: !!activeShare,
    share: activeShare
      ? {
          uuid: activeShare.uuid,
          expiresAt: activeShare.expiresAt,
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/share/${activeShare.uuid}`,
        }
      : null,
  });
}

// 공유 링크 무효화
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ syllabusId: string }> },
) {
  const { syllabusId: _syllabusId } = await params;
  const syllabusId = Number(_syllabusId);

  const session = await getSession();

  if (!session?.user) {
    return new Response('', { status: 401 });
  }

  const syllabus = await prisma.syllabus.findUnique({
    where: {
      id: syllabusId,
      deletedAt: null,
      student: {
        userId: session.user.id,
      },
    },
  });

  if (!syllabus) {
    return new Response('', { status: 404 });
  }

  await prisma.lessonShare.updateMany({
    where: {
      syllabusId: syllabus.id,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  return new Response(null, { status: 204 });
}
