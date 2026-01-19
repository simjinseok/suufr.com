import { redirect } from 'next/navigation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  // .webp 확장자 제거
  const imageKey = key.replace(/\.webp$/, '');

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return new Response(null, { status: 404 });
  }

  // 원본 이미지 그대로 반환 (리사이징/크롭 없음)
  const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/suufr/organizations/${imageKey}`;

  redirect(cloudinaryUrl);
}
