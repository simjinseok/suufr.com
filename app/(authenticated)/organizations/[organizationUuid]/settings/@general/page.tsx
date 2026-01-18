import { notFound } from 'next/navigation';
import { getOrganization } from '@/actions/organization';
import { OrganizationForm } from './_organization-form';

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ organizationUuid: string }>;
}) {
  const { organizationUuid } = await params;
  const organization = await getOrganization(organizationUuid);

  if (!organization) {
    notFound();
  }

  return (
    <OrganizationForm
      organizationUuid={organizationUuid}
      initialData={{
        name: organization.name,
        phone: organization.phone || '',
        address: organization.address || '',
        logoImageKey: organization.logoImageKey || null,
        logoUrl: organization.logoUrl || null,
      }}
    />
  );
}
