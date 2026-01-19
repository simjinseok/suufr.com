import { GlobalSignOutCommand } from '@aws-sdk/client-cognito-identity-provider';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cognitoClient } from '@/utils/cognito.server';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  // Cognito에서 토큰 무효화 (선택적)
  if (accessToken) {
    try {
      await cognitoClient.send(
        new GlobalSignOutCommand({
          AccessToken: accessToken,
        }),
      );
    }
    catch {
      // 토큰이 만료되었을 수 있음, 로컬 로그아웃 진행
    }
  }

  // 쿠키 삭제
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
  cookieStore.delete('cognito_username');
  cookieStore.delete('mfa_session');
  cookieStore.delete('mfa_email');

  return redirect('/login');
}
