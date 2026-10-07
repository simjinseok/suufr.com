import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authApi } from '@/utils/api/auth';
import { ApiError } from '@/utils/api-client';

export async function proxy(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (refreshToken) {
      try {
        const result = await authApi.refresh({ refreshToken });

        // 1. Request cookies 업데이트 (서버 컴포넌트용 - 같은 요청 사이클)
        request.cookies.set('access_token', result.accessToken);

        // 2. Response 생성 및 cookies 설정 (브라우저용 - 다음 요청)
        const response = NextResponse.next({
          request: { headers: request.headers },
        });
        response.cookies.set('access_token', result.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: result.expiresIn - 60,
        });
        return response;
      }
      catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // 세션 만료·폐기. 죽은 refresh_token 을 남기면 매 요청마다 refresh 를 반복하므로 지운다
          const response = NextResponse.redirect(`${request.nextUrl.origin}/login`);
          response.cookies.delete('refresh_token');
          response.cookies.delete('access_token');
          return response;
        }
        // api 장애(연결 실패·5xx). 세션은 살아 있을 수 있으니 쿠키는 두고 사유를 알린다
        return NextResponse.redirect(`${request.nextUrl.origin}/login?error=unavailable`);
      }
    }

    // refresh_token 이 없으면 로그인으로
    return NextResponse.redirect(`${request.nextUrl.origin}/login`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!api|webhook|.well-known|auth|health|login|signup|verify-email|forgot-password|reset-password|pricing|terms|privacy|refunds|robots.txt|sitemap.xml|auth/logout|sl/*|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)',
  ],
};
