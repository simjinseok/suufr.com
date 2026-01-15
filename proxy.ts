import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshAccessToken } from '@/utils/token-refresh';

export async function proxy(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const username = cookieStore.get('cognito_username')?.value;

    if (refreshToken && username) {
      const newTokens = await refreshAccessToken(refreshToken, username);

      if (newTokens) {
        const response = NextResponse.next();
        response.cookies.set('access_token', newTokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: newTokens.expires_in - 60,
        });
        return response;
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
    '/((?!api|health|login|signup|verify-email|forgot-password|reset-password|auth/logout|sl/*|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)',
  ],
};
