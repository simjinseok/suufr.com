import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

import { redirect } from "next/navigation";
import { Heading } from "@/components/heading";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import React from "react";
import Syllabuses from './_syllabuses';

const PAGE_SIZE = 20;
export default async function Page({
  searchParams,
}: { searchParams: { page: number; student: string } }) {
  const page = searchParams.page > 0 ? Number(searchParams.page) : 1;

  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const studentId = Number(searchParams.student);
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
          }
        },
        lessons: {
          select: {
            id: true,
            lessonAt: true,
            isDone: true,
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paidAt: true,
          }
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
      createdAt: "desc",
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


  const student = studentId ? await prisma.student.findUnique({
    where: {
      id: studentId,
      deletedAt: null,
    }
  }) : null;

  return (
    <div>
      <Heading>계획</Heading>
      <Syllabuses student={student} syllabuses={syllabuses} />
      <div className="mt-5 flex justify-between">
        {page > 1 && (
          <Link
            className="flex items-center"
            href={{
              query: {
                ...searchParams,
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
                ...searchParams,
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
