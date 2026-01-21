import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authApi } from '@/utils/api/auth';

export async function proxy(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const username = cookieStore.get('cognito_username')?.value;

    if (refreshToken && username) {
      try {
        const result = await authApi.refresh({ refreshToken, username });

        // 1. Request cookies 업데이트 (서버 컴포넌트용 - 같은 요청 사이클)
        request.cookies.set('access_token', result.accessToken);

        // 2. Response 생성 및 cookies 설정 (브라우저용 - 다음 요청)
        const response = NextResponse.next({
          request: { headers: request.headers },
        });
        response.cookies.set('access_token', result.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: result.expiresIn - 60,
        });
        return response;
      }
      catch {
        // Refresh failed, redirect to login
      }
    }

    // refresh_token이 없거나 갱신 실패 시 로그인으로 리다이렉트
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
    '/((?!api|dav|.well-known|health|login|signup|verify-email|forgot-password|reset-password|auth/logout|sl/*|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)',
  ],
};
