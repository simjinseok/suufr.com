import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { getSession } from '@/utils/auth';
import { authApi } from '@/utils/api/auth';

export default async function UnauthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  // 1. 기존 세션 체크
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  // 2. access_token이 없지만 refresh_token이 있으면 갱신 시도
  const refreshToken = cookieStore.get('refresh_token')?.value;
  const username = cookieStore.get('cognito_username')?.value;

  if (refreshToken && username) {
    try {
      const result = await authApi.refresh({ refreshToken, username });

      // 토큰 갱신 성공 시 쿠키 설정
      const isProduction = process.env.NODE_ENV === 'production';
      cookieStore.set('access_token', result.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: result.expiresIn - 60,
      });

      // 세션이 있으므로 dashboard로 리다이렉트
      redirect('/dashboard');
    } catch {
      // 갱신 실패 시 children 렌더링
    }
  }

  return <>{children}</>;
}
