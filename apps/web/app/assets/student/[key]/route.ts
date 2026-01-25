import { redirect } from 'next/navigation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  // .webp 확장자 제거
  const imageKey = key.replace(/\.webp$/, '');

  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl) {
    return new Response(null, { status: 404 });
  }

  // Bunny CDN URL with optimization parameters
  const imageUrl = `${cdnUrl}/images/${imageKey}?width=112&quality=80&format=webp`;

  redirect(imageUrl);
}
