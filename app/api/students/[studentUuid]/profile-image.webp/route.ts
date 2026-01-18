import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { optimizeImageUrl } from '@/utils/cloudinary-url';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentUuid: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const { studentUuid } = await params;

  const student = await prisma.student.findUnique({
    where: { uuid: studentUuid, userId: session.user.id, deletedAt: null },
    select: { profileImageUrl: true, updatedAt: true },
  });

  if (!student?.profileImageUrl) {
    return new NextResponse(null, { status: 404 });
  }

  // ETag 생성 (updatedAt 기반)
  const etag = `"${student.updatedAt.getTime()}"`;

  // If-None-Match 헤더 확인 - ETag 일치 시 304 반환
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 });
  }

  // Cloudinary URL에 최적화 파라미터 추가
  const optimizedUrl = optimizeImageUrl(student.profileImageUrl, {
    width: 112, // 56px * 2 for retina
    format: 'webp',
  });

  if (!optimizedUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const imageResponse = await fetch(optimizedUrl);

  if (!imageResponse.ok) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(imageResponse.body, {
    headers: {
      'Content-Type': 'image/webp',
      'ETag': etag,
      'Cache-Control': 'private, no-cache',
    },
  });
}
