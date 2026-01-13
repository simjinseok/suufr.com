import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const domain = process.env.COGNITO_DOMAIN!;
  const clientId = process.env.COGNITO_CLIENT_ID!;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET!;

  const tokenEndpoint = `https://${domain}/oauth2/token`;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (refreshToken) {
      const newTokens = await refreshAccessToken(refreshToken);

      if (newTokens) {
        const response = NextResponse.next();
        response.cookies.set('access_token', newTokens.access_token, {
          httpOnly: true,
          maxAge: newTokens.expires_in - 60,
        });
        return response;
      }
    }

    // refresh_token이 없거나 갱신 실패 시 로그인으로 리다이렉트
    return NextResponse.redirect(`${request.nextUrl.origin}/auth/cognito`);
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
    '/((?!api|health|auth/cognito|auth/cognito/callback|sl/*|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).+)',
  ],
};
