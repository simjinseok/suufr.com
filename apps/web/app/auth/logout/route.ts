import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authApi } from '@/utils/api/auth';

export async function GET() {
  const cookieStore = await cookies();

  // 서버 세션 폐기 (better-auth). 실패해도 쿠키는 지운다
  const refreshToken = cookieStore.get('refresh_token')?.value;
  if (refreshToken) {
    try {
      await authApi.logout({ refreshToken });
    }
    catch {
      // 이미 만료된 세션 등 — 무시
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
