import { createLoader, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs/server';

import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import ConditionForm from './_condition-form';
import NewStudent from './_new-student';
import Students from './_students';
import { getSession } from '@/utils/auth';
import { studentsApi } from '@/utils/api';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const loadSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  status: parseAsStringEnum(['', 'pending', 'active', 'paused', 'leave']).withDefault('active'),
  q: parseAsString.withDefault(''),
});

export default async function Page(props: PageProps<'/students'>) {
  const { page, status, q } = await loadSearchParams(props.searchParams);

  const session = await getSession();
  if (!session?.organization) {
    return null;
  }

  const { data: students, meta } = await studentsApi.list({
    organizationUuids: [session.organization.uuid],
    page,
    limit: PAGE_SIZE,
    status,
    q,
  });

  // profileImageUrl은 이미 Cloudinary URL로 저장되어 있음
  const studentsWithImageUrl = students;

  return (
    <div className="mt-3">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">수강생 목록</h1>
        <NewStudent />
      </div>

      <div className="mt-5 flex justify-between">
        <ConditionForm currentStatus={status} />
      </div>

      <Students students={studentsWithImageUrl} />

      <div className="mt-5 flex justify-between">
        {page > 1 && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page - 1,
                status: status,
                ...(q && { q }),
              },
            }}
          >
            <ChevronLeftIcon />
            이전 페이지
          </Link>
        )}
        {(meta.totalCount > (page * PAGE_SIZE)) && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page + 1,
                status: status,
                ...(q && { q }),
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
