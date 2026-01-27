import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createFileSchema } from '@/schemas/storage';

const API_URL = process.env.API_URL!;

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { message: '인증이 필요합니다.' },
      { status: 401 },
    );
  }

  const response = await fetch(`${API_URL}/api/storage/files`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json(
      { message: '인증이 필요합니다.' },
      { status: 401 },
    );
  }

  const body = await request.json();

  const parsed = createFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: '잘못된 요청입니다.', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const response = await fetch(`${API_URL}/api/storage/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(parsed.data),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
