import { createLoader, parseAsInteger, parseAsString } from 'nuqs/server';

import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import NewSession from './_new-session';
import SessionsList from './_sessions-list';
import { StudentFilter } from '@/components/student/student-filter';
import { getSession } from '@/utils/auth';
import { sessionsApi, studentsApi } from '@/utils/api';
import { getUserSettings } from '@/utils/user-settings';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const loadSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  student: parseAsString.withDefault(''),
});

export default async function Page(props: PageProps<'/sessions'>) {
  const { page, student } = await loadSearchParams(props.searchParams);

  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;

  const [settings, { data: sessions, meta }, selectedStudent] = await Promise.all([
    getUserSettings(),
    sessionsApi.list({
      organizationUuids: [organization.uuid],
      page,
      limit: PAGE_SIZE,
      order: 'desc',
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
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">세션</h1>
        <NewSession />
      </div>

      <div className="mt-5 flex justify-between">
        <StudentFilter selected={selectedStudent} />
      </div>

      <SessionsList
        sessions={sessions.map(item => ({
          uuid: item.uuid,
          sessionAt: item.sessionAt,
          duration: item.duration,
          notes: item.notes,
          isDone: item.isDone,
          // 삭제된 수강권 귀속은 표시하지 않는다
          invoiceTitle: item.invoice && !item.invoice.deletedAt
            ? (item.invoice.title || '수강권')
            : null,
          student: {
            uuid: item.student.uuid,
            name: item.student.name,
          },
        }))}
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
