import { notFound } from 'next/navigation';
import { organizationsApi } from '@/utils/api/organizations';
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
  const { organizationUuid } = await params;

  let organization;
  try {
    const response = await organizationsApi.get(organizationUuid);
    organization = response.data;
  }
  catch {
    notFound();
  }

  // Owner 권한 체크: API에서 members를 포함해서 반환하므로 현재 사용자가 owner인지 확인
  // organizationsApi.get은 인증된 사용자가 멤버가 아니면 403을 반환하고,
  // role은 members 배열에서 확인해야 함
  // 그러나 현재 API 구조상 role 정보가 없으므로 일단 조직 정보만 표시
  // TODO: API에서 현재 사용자의 role도 반환하도록 수정 필요

  const tabs = [
    { id: 'general', label: '조직 정보' },
    { id: 'members', label: '멤버 관리' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">과외방 설정</h1>
        <p className="mt-1 text-sm text-gray-500">{organization.name}</p>
      </div>

      <SettingsTabs tabs={tabs} general={general} members={members} />
    </div>
  );
}
