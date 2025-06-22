import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';

import { redirect } from 'next/navigation';
import { Heading } from '@/components/heading';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import React from 'react';
import Syllabuses from './_syllabuses';
import SearchForm from './_search-form';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
export default async function Page({
  searchParams,
}: { searchParams: Promise<{ page: number; student: string }> }) {
  const { page: _page, student: _student } = await searchParams;
  const page = _page > 0 ? Number(_page) : 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const studentId = Number(_student);
  const syllabuses = await prisma.syllabus.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      notes: true,
      student: {
        select: {
          id: true,
          name: true,
        },
      },
      lessons: {
        select: {
          id: true,
          notes: true,
          lessonAt: true,
          isDone: true,
          feedback: {
            select: {
              id: true,
              notes: true,
            },
            where: {
              deletedAt: null,
            },
          },
        },
        where: {
          deletedAt: null,
        },
        orderBy: {
          lessonAt: 'asc',
        },
      },
      payment: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paidAt: true,
        },
        where: {
          deletedAt: null,
        },
      },
    },
    where: {
      deletedAt: null,
      student: {
        ...(studentId ? { id: studentId } : {}),
        userId: user.id,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const syllabusCount: number = await prisma.syllabus.count({
    where: {
      deletedAt: null,
      student: {
        userId: user.id,
      },
    },
  });

  const student = studentId
    ? await prisma.student.findUnique({
      where: {
        id: studentId,
        deletedAt: null,
      },
    })
    : null;

  return (
    <div>
      <Heading>계획</Heading>
      <SearchForm />
      {student && (
        <div className="mt-5 p-3 border rounded">
          <p className="text-base font-bold">{student.name}</p>
          <p className="whitespace-pre">{student.notes}</p>
        </div>
      )}
      <Syllabuses student={student} syllabuses={syllabuses} />
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
        {syllabusCount > page * PAGE_SIZE && (
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
