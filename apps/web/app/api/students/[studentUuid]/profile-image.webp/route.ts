import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { studentsApi } from '@/utils/api/students';
import { buildCloudinaryUrl } from '@/utils/cloudinary-url.server';

// 기존 라우트 - 새 /assets/student/[key] 라우트로 리다이렉트
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentUuid: string }> },
) {
  const { studentUuid } = await params;

  let student;
  try {
    const response = await studentsApi.get(studentUuid);
    student = response.data;
  }
  catch {
    return new NextResponse(null, { status: 404 });
  }

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
