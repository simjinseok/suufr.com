import cognito from '@/utils/arctic.server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();

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

  cookieStore.set('access_token', token.data.access_token, {
    httpOnly: true,
    maxAge: token.data.expires_in - 60,
  });
  cookieStore.set('refresh_token', token.data.refresh_token, { httpOnly: true });

  return redirect('/');
}
