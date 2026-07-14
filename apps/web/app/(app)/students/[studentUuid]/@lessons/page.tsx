import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/utils/user-settings';
import { invoicesApi, sessionsApi, studentSharesApi } from '@/utils/api';

import Invoices from './_lessons';

const PAGE_SIZE = 20;
export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;
  const settings = await getUserSettings();
  const { studentUuid } = await params;

  const [{ data: invoices }, { data: shares }, { data: sessions }] = await Promise.all([
    invoicesApi.list({
      organizationUuids: [organization.uuid],
      studentUuid,
      limit: PAGE_SIZE,
    }),
    studentSharesApi.listByStudent(studentUuid),
    sessionsApi.list({
      organizationUuids: [organization.uuid],
      studentUuid,
      limit: 100,
    }),
  ]);

  // 청구에 연결 안 된 수업 (삭제된 청구 귀속 포함 — docs/schema-redesign.md §3)
  const unattachedSessions = sessions.filter(s => !s.invoice || s.invoice.deletedAt);

  return (
    <Invoices
      invoices={invoices}
      shares={shares}
      unattachedSessions={unattachedSessions}
      use24HourFormat={settings.use24HourFormat}
    />
  );
}
