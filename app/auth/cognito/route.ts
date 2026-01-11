import { generateCodeVerifier, generateState } from 'arctic';
import cognito from '@/utils/arctic.server';

import { cookies } from 'next/headers';

export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const cookieStore = await cookies();

  const url = cognito.createAuthorizationURL(state, codeVerifier, ['openid']);
  cookieStore.set('oauth_state', state, { httpOnly: true });
  cookieStore.set('code_verifier', codeVerifier, { httpOnly: true });

  return Response.redirect(url);
};
