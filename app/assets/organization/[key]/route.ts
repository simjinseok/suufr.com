import { redirect } from 'next/navigation';
import { buildCloudinaryUrl } from '@/utils/cloudinary-url.server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  // .webp 확장자 제거
  const imageKey = key.replace(/\.webp$/, '');

  const cloudinaryUrl = buildCloudinaryUrl(imageKey, 'organizations', {
    width: 200,
    format: 'webp',
  });

  if (!cloudinaryUrl) {
    return new Response(null, { status: 404 });
  }

  redirect(cloudinaryUrl);
}
