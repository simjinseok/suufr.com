import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { buildCloudinaryUrl } from '@/utils/cloudinary-url.server';

// 기존 라우트 - 새 /assets/student/[key] 라우트로 리다이렉트
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentUuid: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const { studentUuid } = await params;

  const student = await prisma.student.findUnique({
    where: { uuid: studentUuid, userId: session.user.id, deletedAt: null },
    select: { profileImageKey: true },
  });

  if (!student?.profileImageKey) {
    return new NextResponse(null, { status: 404 });
  }

  const cloudinaryUrl = buildCloudinaryUrl(student.profileImageKey, 'students', {
    width: 112,
    format: 'webp',
  });

  if (!cloudinaryUrl) {
    return new NextResponse(null, { status: 404 });
  }

  redirect(cloudinaryUrl);
}
