import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/actions/settings';
import { lessonsApi } from '@/utils/api';

import Lessons from './_lessons';

const PAGE_SIZE = 20;
export default async function LessonsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { user, organization } = session;
  const settings = await getUserSettings(user.id);
  const { studentUuid } = await params;

  const { data: lessons } = await lessonsApi.list({
    organizationUuids: [organization.uuid],
    studentUuid,
    limit: PAGE_SIZE,
  });

  return <Lessons lessons={lessons} use24HourFormat={settings.use24HourFormat} />;
}
