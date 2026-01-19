import { redirect } from 'next/navigation';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationUuid: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { organizationUuid } = await params;

  // 해당 조직의 멤버인지 확인
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: { uuid: organizationUuid },
      deletedAt: null,
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    redirect('/dashboard');
  }

  // UserSettings 업데이트
  await prisma.userSettings.update({
    where: { userId: session.user.id },
    data: { currentOrganizationId: membership.organization.id },
  });

  redirect('/dashboard');
}
