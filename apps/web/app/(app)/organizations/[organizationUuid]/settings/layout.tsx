import { notFound } from 'next/navigation';
import { organizationsApi } from '@/utils/api/organizations';

export default async function OrganizationSettingsLayout({
  general,
  params,
}: {
  general: React.ReactNode;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">과외방 설정</h1>
        <p className="mt-1 text-sm text-gray-500">{organization.name}</p>
      </div>

      {general}
    </div>
  );
}
