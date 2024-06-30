import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";

import { redirect } from "next/navigation";
import { Heading } from "@/components/heading";
import Link from "next/link";
import { TextLink } from "@/components/text";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { formatToKoreanNumber } from "@toss/utils";
import React from "react";

const PAGE_SIZE = 20;
export default async function Page({
  searchParams,
}: { searchParams: { page: number } }) {
  const page = searchParams.page > 0 ? Number(searchParams.page) : 1;

  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const syllabuses = await prisma.syllabus.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      student: true,
      payment: true,
    },
    where: {
      deletedAt: null,
      student: {
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

  return (
    <div>
      <Heading>계획</Heading>
      {syllabuses.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>학생명</TableHeader>
              <TableHeader>제목</TableHeader>
              <TableHeader>결제 정보</TableHeader>
              <TableHeader>메모</TableHeader>
              <TableHeader>링크</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {syllabuses.map((syllabus) => (
              <TableRow key={`syllabus-${syllabus.id}`}>
                <TableCell>{syllabus.student.name}</TableCell>
                <TableCell>{syllabus.title}</TableCell>
                <TableCell>
                  {syllabus.payment ? (
                    <>
                      {syllabus.payment.paymentMethod}{" "}
                      {formatToKoreanNumber(syllabus.payment.amount)}원
                    </>
                  ) : (
                    <p>미입금</p>
                  )}
                </TableCell>
                <TableCell>{syllabus.notes}</TableCell>
                <TableCell>
                  <Link
                    passHref
                    legacyBehavior
                    href={`/syllabuses/${syllabus.id}`}
                  >
                    <TextLink href="">상세보기</TextLink>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div>입금 내역이 없어요</div>
      )}
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
