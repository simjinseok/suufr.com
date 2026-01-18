import { getOrganizationMembers } from '@/actions/member';
import { MembersContent } from './_content';

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ organizationUuid: string }>;
}) {
  const { organizationUuid } = await params;
  const members = await getOrganizationMembers(organizationUuid);

  return (
    <MembersContent organizationUuid={organizationUuid} initialMembers={members} />
  );
}
