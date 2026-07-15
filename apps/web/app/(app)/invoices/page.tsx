import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';

import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import NewInvoice from './_new-invoice';
import InvoicesList from './_invoices-list';
import { getSession } from '@/utils/auth';
import { invoicesApi, studentsApi } from '@/utils/api';
import { getUserSettings } from '@/utils/user-settings';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const loadSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  student: parseAsString.withDefault(''),
});

export default async function Page(props: PageProps<'/invoices'>) {
  const { page, student } = await loadSearchParams(props.searchParams);

  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;

  const [settings, { data: invoices, meta }, selectedStudent] = await Promise.all([
    getUserSettings(),
    invoicesApi.list({
      organizationUuids: [organization.uuid],
      page,
      limit: PAGE_SIZE,
      ...(student && { studentUuid: student }),
    }),
    // 필터 버튼 라벨용 — 잘못된 uuid면 전체로 취급
    student
      ? studentsApi.get(student)
          .then(res => ({ uuid: res.data.uuid, name: res.data.name }))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="mt-3">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">수강권</h1>
        <NewInvoice />
      </div>

      <InvoicesList
        invoices={invoices.map(invoice => ({
          uuid: invoice.uuid,
          title: invoice.title,
          price: invoice.price,
          totalCount: invoice.totalCount,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          // 수업 목록은 수업일 내림차순 (API 기본은 오름차순)
          sessions: invoice.sessions
            .map(s => ({
              uuid: s.uuid,
              sessionAt: s.sessionAt,
              duration: s.duration,
              isDone: s.isDone,
            }))
            .sort((a, b) => b.sessionAt.localeCompare(a.sessionAt)),
          student: {
            uuid: invoice.student.uuid,
            name: invoice.student.name,
          },
        }))}
        selectedStudent={selectedStudent}
        use24HourFormat={settings.use24HourFormat}
      />

      <div className="mt-5 flex justify-between">
        {page > 1 && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page - 1,
                ...(student && { student }),
              },
            }}
          >
            <ChevronLeftIcon />
            이전 페이지
          </Link>
        )}
        {(meta.totalCount > (page * PAGE_SIZE)) && (
          <Link
            className="flex items-center ml-auto"
            href={{
              query: {
                page: page + 1,
                ...(student && { student }),
              },
            }}
          >
            다음 페이지
            <ChevronRightIcon />
          </Link>
        )}
      </div>
    </div>
  );
}
