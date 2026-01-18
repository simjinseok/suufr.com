import { notFound } from 'next/navigation';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { SettingsTabs } from '@/components/settings-tabs';

export default async function OrganizationSettingsLayout({
  general,
  members,
  params,
}: {
  general: React.ReactNode;
  members: React.ReactNode;
  params: Promise<{ organizationUuid: string }>;
}) {
  const session = await getSession();
  const { organizationUuid } = await params;

  if (!session?.user?.id) {
    notFound();
  }

  // Owner 권한 체크
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

  if (!membership || membership.role !== 'owner') {
    notFound();
  }

  const tabs = [
    { id: 'general', label: '조직 정보' },
    { id: 'members', label: '멤버 관리' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">과외방 설정</h1>
        <p className="mt-1 text-sm text-gray-500">{membership.organization.name}</p>
      </div>

      <SettingsTabs tabs={tabs} general={general} members={members} />
    </div>
  );
}
