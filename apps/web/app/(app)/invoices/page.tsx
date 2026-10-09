import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';

import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { format } from 'date-fns/format';
import { tz } from '@date-fns/tz';

import NewInvoice from './_new-invoice';
import InvoicesList from './_invoices-list';
import { getSession } from '@/utils/auth';
import { invoicesApi, studentsApi } from '@/utils/api';
import { getUserSettings } from '@/utils/user-settings';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { countDoneSessions } from '@/utils/invoice-status';

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

  // 카드의 "N일 남음"·경과 바는 유저 타임존의 오늘을 기준으로 — 서버에서 한 번만 계산
  const today = format(new Date(), 'yyyy-MM-dd', { in: tz(settings.timezone ?? DEFAULT_TIMEZONE) });

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
          doneCount: countDoneSessions(invoice.sessions),
          student: {
            uuid: invoice.student.uuid,
            name: invoice.student.name,
            profileImageUrl: invoice.student.profileImageUrl,
          },
          payments: invoice.payments.map(p => ({
            uuid: p.uuid,
            amount: p.amount,
            paidAt: p.paidAt,
          })),
        }))}
        selectedStudent={selectedStudent}
        today={today}
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
