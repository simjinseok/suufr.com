import type { TMeeting } from '@/types/index';

import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';

import React from 'react';
import Link from 'next/link';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import Edit from './_edit';
import Heading from './_heading';
import Meetings from './_meetings';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
export default async function Page({ searchParams }: any) {
  const { page: _page, edit: _edit } = await searchParams;
  const page = _page > 0 ? Number(_page) : 1;

  const { user } = await getSession();

  const meetings: TMeeting[] = await prisma.meeting.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      isDone: true,
      phone: true,
      notes: true,
      meetingAt: true,
    },
    where: {
      userId: user.id,
      deletedAt: null,
    },
    orderBy: {
      meetingAt: 'desc',
    },
  });
  const meetingsCount = await prisma.meeting.count({
    where: {
      userId: user.id,
      deletedAt: null,
    },
  });

  const editingMeeting = _edit
    ? meetings.find(m => m.id === Number(_edit))
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
