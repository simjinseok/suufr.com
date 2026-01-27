import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;

/**
 * CloudFront Signed Cookies 발급 API 프록시
 * 백엔드에서 발급한 쿠키를 클라이언트에 전달
 */
export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/session/cookies`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to get cookies' },
        { status: response.status },
      );
    }

    const data = await response.json();

    // CloudFront 쿠키를 응답 헤더로 전달
    const nextResponse = NextResponse.json(data);

    // 백엔드 응답에서 Set-Cookie 헤더를 가져와서 전달
    const setCookieHeaders = response.headers.getSetCookie();
    for (const setCookie of setCookieHeaders) {
      nextResponse.headers.append('Set-Cookie', setCookie);
    }

    return nextResponse;
  } catch (error) {
    console.error('CloudFront cookies error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
