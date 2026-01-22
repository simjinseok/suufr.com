import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationUuid: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { organizationUuid } = await params;

  // 세션의 organizations에서 해당 조직 찾기
  const targetOrg = session.organizations?.find(org => org.uuid === organizationUuid);
  if (!targetOrg) {
    redirect('/dashboard');
  }

  // 쿠키에 organization_uuid 설정
  const cookieStore = await cookies();
  cookieStore.set('organization_uuid', targetOrg.uuid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1년
  });

  redirect('/dashboard');
}
