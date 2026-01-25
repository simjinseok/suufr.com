import { getSession } from '@/utils/auth';
import { studentsApi } from '@/utils/api';
import StatsCards from './_stats-cards';

export default async function StatsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const { studentUuid } = await params;
  const session = await getSession();

  if (!session?.organization) {
    return null;
  }

  const { data: stats } = await studentsApi.getStats(studentUuid);

  return <StatsCards stats={stats} />;
}
