import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { fetchSession } from '@/utils/auth';
import { authApi } from '@/utils/api/auth';

export default async function UnauthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  // 1. 기존 세션 체크. api 장애(ok: false)면 로그인 화면을 그대로 그린다 — 여기서 리다이렉트하면 /login 에서 무한 루프
  const result = await fetchSession();
  if (result.ok && result.session) {
    redirect('/dashboard');
  }

  // 2. access_token이 없지만 refresh_token이 있으면 세션이 살아 있는지 확인한다.
  //    서버 컴포넌트에서는 쿠키를 쓸 수 없고 redirect()는 throw 로 동작하므로 try 밖에서 호출한다.
  //    실제 access_token 재발급은 /dashboard 요청을 받은 proxy.ts 가 수행한다.
  const refreshToken = cookieStore.get('refresh_token')?.value;
  let sessionAlive = false;

  if (refreshToken) {
    try {
      await authApi.refresh({ refreshToken });
      sessionAlive = true;
    }
    catch {
      // 세션 만료 — 로그인 화면 렌더링
    }
  }

  if (sessionAlive) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
