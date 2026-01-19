import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { uploadImage, UPLOAD_CONFIG } from '@/utils/cloudinary';

export async function POST(request: Request) {
  const { user } = await getSession();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    if (file.size > UPLOAD_CONFIG.maxFileSize) {
      return NextResponse.json({ error: '파일 크기는 1MB 이하여야 합니다.' }, { status: 400 });
    }

    if (!UPLOAD_CONFIG.allowedFormats.includes(file.type)) {
      return NextResponse.json({ error: 'JPG, PNG, WebP 형식만 지원합니다.' }, { status: 400 });
    }

    const result = await uploadImage(file);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ url: result.url, publicId: result.publicId });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: '업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
