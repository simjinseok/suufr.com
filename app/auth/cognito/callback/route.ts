import cognito from '@/utils/arctic.server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();

  // State 파라미터 검증 (CSRF 방지)
  const state = url.searchParams.get('state');
  const storedState = cookieStore.get('oauth_state')?.value;

  if (!state || !storedState || state !== storedState) {
    return new Response('Invalid state parameter', { status: 400 });
  }

  const code = url.searchParams.get('code') as string;
  const codeVerifier = cookieStore.get('code_verifier')?.value as string;

  const token = await cognito.validateAuthorizationCode(code, codeVerifier) as {
    data: {
      id_token: string;
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };
  };

  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set('access_token', token.data.access_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: token.data.expires_in - 60,
  });
  cookieStore.set('refresh_token', token.data.refresh_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
  });

  return redirect('/');
}
