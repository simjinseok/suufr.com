import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET() {
  const cookieStore = await cookies();

  // 쿠키 삭제
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');
  cookieStore.delete('cognito_username');
  cookieStore.delete('mfa_session');
  cookieStore.delete('mfa_email');

  return redirect('/login');
}
