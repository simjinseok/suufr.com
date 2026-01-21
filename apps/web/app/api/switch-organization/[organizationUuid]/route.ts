import { redirect } from 'next/navigation';
import { getSession } from '@/utils/auth';
import { organizationsApi } from '@/utils/api/organizations';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationUuid: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { organizationUuid } = await params;

  // 세션의 organizations에서 해당 조직이 있는지 확인
  const hasAccess = session.organizations?.some(org => org.uuid === organizationUuid);
  if (!hasAccess) {
    redirect('/dashboard');
  }

  // API를 통해 조직 전환 (UserSettings 업데이트)
  try {
    await organizationsApi.switch(organizationUuid);
  }
  catch {
    redirect('/dashboard');
  }

  redirect('/dashboard');
}
