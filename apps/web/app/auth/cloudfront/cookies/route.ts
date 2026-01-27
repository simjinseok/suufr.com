import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;

/**
 * CloudFront Signed Cookies 발급
 * 백엔드에서 쿠키 값을 받아 클라이언트에 Set-Cookie 헤더로 전달
 */
export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/cloudfront/cookies`, {
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

    if (!data.configured) {
      return NextResponse.json({ success: true, configured: false });
    }

    // 쿠키 값을 받아서 직접 Set-Cookie 헤더 설정
    const { cookies: cfCookies, cookieOptions } = data;
    const nextResponse = NextResponse.json({ success: true, configured: true });

    const cookieConfig = {
      domain: cookieOptions.domain,
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: cookieOptions.maxAge,
    };

    nextResponse.cookies.set('CloudFront-Policy', cfCookies['CloudFront-Policy'], cookieConfig);
    nextResponse.cookies.set('CloudFront-Signature', cfCookies['CloudFront-Signature'], cookieConfig);
    nextResponse.cookies.set('CloudFront-Key-Pair-Id', cfCookies['CloudFront-Key-Pair-Id'], cookieConfig);

    return nextResponse;
  } catch (error) {
    console.error('CloudFront cookies error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
