import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET() {
  const cookieStore = await cookies();

  // 쿠키 삭제
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');

  // Cognito 로그아웃 URL로 리다이렉트
  const cognitoDomain = process.env.COGNITO_DOMAIN;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const logoutUri = `${process.env.NEXT_PUBLIC_BASE_URL}/login`;

  const logoutUrl = `https://${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;

  return redirect(logoutUrl);
}
