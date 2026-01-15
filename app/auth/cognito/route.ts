import { generateCodeVerifier, generateState } from 'arctic';
import cognito from '@/utils/arctic.server';

import { cookies } from 'next/headers';

export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  const url = cognito.createAuthorizationURL(state, codeVerifier, ['openid']);
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax', // OAuth redirect를 위해 lax 사용
  });
  cookieStore.set('code_verifier', codeVerifier, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });

  return Response.redirect(url);
};
