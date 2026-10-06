import { NextResponse, type NextRequest } from 'next/server';
import { authApi } from '@/utils/api/auth';
import { setMfaSessionCookie, setTokenCookies } from '@/utils/auth-cookies';

/**
 * Google 로그인 완료 (GET /auth/google/login?code=…). api 의 social/google/complete 가 인계 코드와 함께 여기로 보낸다.
 * (/auth/google/callback 은 캘린더 연동용 OAuth 콜백이라 경로가 다르다.)
 * 코드를 토큰으로 교환해 쿠키를 심고 대시보드로, 2FA 사용자는 챌린지를 보관하고 로그인 화면의 2단계로 보낸다.
 */
export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(`${origin}/login?error=social`);

  try {
    const result = await authApi.social.exchange({ code });

    if (!result.success) return NextResponse.redirect(`${origin}/login?error=social`);

    if (result.requiresMfa) {
      await setMfaSessionCookie(result.session);
      return NextResponse.redirect(`${origin}/login?step=mfa`);
    }

    await setTokenCookies(result);
    return NextResponse.redirect(`${origin}/dashboard`);
  }
  catch {
    return NextResponse.redirect(`${origin}/login?error=social`);
  }
}
