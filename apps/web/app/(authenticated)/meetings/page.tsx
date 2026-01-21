import React from 'react';
import Link from 'next/link';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { getSession } from '@/utils/auth';
import { meetingsApi } from '@/utils/api/meetings';

import Edit from './_edit';
import Heading from './_heading';
import Meetings from './_meetings';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

export default async function Page({ searchParams }: any) {
  const { page: _page, edit: _edit } = await searchParams;
  const page = _page > 0 ? Number(_page) : 1;

  const session = await getSession();
  if (!session?.organization) {
    return null;
  }
  const { organization } = session;

  const response = await meetingsApi.list({
    organizationUuids: [organization.uuid],
    page,
    limit: PAGE_SIZE,
  });

  const meetings = response.data;
  const meetingsCount = response.meta.totalCount;

  const editingMeeting = _edit
    ? meetings.find(m => m.uuid === _edit)
    : null;

  return (
    <div>
      <Heading />
      <Meetings meetings={meetings} />
      <div className="mt-5 flex justify-between">
        {page > 1 && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page - 1,
              },
            }}
          >
            <ChevronLeftIcon />
            이전 페이지
          </Link>
        )}
        {meetingsCount > page * PAGE_SIZE && (
          <Link
            className="flex items-center"
            href={{
              query: {
                page: page + 1,
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
