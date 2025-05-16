import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';
import { formatToKoreanNumber } from '@toss/utils';

import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Card } from '@heroui/react';
import Filter from './_filter';
import Payments from './_payments';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
type Props = {
  searchParams: {
    page: string;
    edit: string;
    student: string;
    from: string;
    to: string;
  };
};
export default async function Page({ searchParams }: Props) {
  const { page: _page, student: _student, from: _from, to: _to } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const page = Number(_page) > 0 ? Number(_page) : 1;
  const studentId = Number(_student);
  const from = _from ? new Date(_from) : new Date(0);
  const to = _to ? new Date(_to) : new Date(2040, 1, 1);
  const where = {
    deletedAt: null,
    ...(from
      ? {
          paidAt: {
            gte: from,
            lte: to,
          },
        }
      : {}),
    syllabus: {
      student: {
        ...(studentId ? { id: studentId } : {}),
        userId: user.id,
        deletedAt: null,
      },
    },
  };
  const payments = await prisma.payment.findMany({
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    include: {
      syllabus: {
        include: {
          student: true,
        },
      },
    },
    where,
    orderBy: {
      paidAt: 'desc',
    },
  });
  const paymentsCount = await prisma.payment.count({
    where,
  });

  const syllabuses = await prisma.syllabus.findMany({
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    select: {
      id: true,
      payment: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          notes: true,
          paidAt: true,
        },
      },
      student: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    where: {
      NOT: {
        payment: null,
      },
      payment: {
        deletedAt: null,
      },
      student: {
        userId: user.id,
        deletedAt: null,
      },
    },
    orderBy: {
      payment: {
        paidAt: 'desc',
      },
    },
  });

  return (
    <div>
      <div className="flex flex-col">
        <h1 className="text-xl font-bold text-default-900 lg:text-3xl">입금 내역</h1>
      </div>
      {payments.length > 0 && (
        <div className="mt-6">
          <div className="grid grid-cols-4 gap-x-4">
            <Card className=" border border-transparent dark:border-default-100">
              <div className="flex p-4">
                <div className="flex flex-col gap-y-2">
                  <dt className="text-small font-medium text-default-500">결제 건수</dt>
                  <dd className="text-2xl font-semibold text-default-700">
                    {payments.length}
                    건
                  </dd>
                </div>
              </div>
            </Card>

            <Card className=" border border-transparent dark:border-default-100">
              <div className="flex p-4">
                <div className="flex flex-col gap-y-2">
                  <dt className="text-small font-medium text-default-500">결제 금액</dt>
                  <dd className="text-2xl font-semibold text-default-700">
                    {formatToKoreanNumber(payments.reduce((t, p) => t + p.amount, 0))}
                    원
                  </dd>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
      <Filter />

      <Payments
        syllabuses={syllabuses}
      />

      <div className="mt-10 flex justify-between">
        <div>
          {page > 1 && (
            <Link
              className="flex items-center"
              href={{
                query: {
                  student: _student,
                  from: _from,
                  to: _to,
                  page: page - 1,
                },
              }}
            >
              <ChevronLeftIcon />
              이전 페이지
            </Link>
          )}
        </div>
        <div>
          {paymentsCount > page * PAGE_SIZE && (
            <Link
              className="flex items-center"
              href={{
                query: {
                  student: _student,
                  from: _from,
                  to: _to,
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
    </div>
  );
}
