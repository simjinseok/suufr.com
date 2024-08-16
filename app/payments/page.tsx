import {createClient} from "@/utils/supabase";
import {PrismaClient} from "@prisma/client";
import {format} from "date-fns/format";
import {formatToKoreanNumber} from "@toss/utils";

import React from "react";
import {redirect} from "next/navigation";
import Link from "next/link";
import {ChevronLeftIcon, ChevronRightIcon} from "lucide-react";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "@/components/description-list";
import {Heading} from "@/components/heading";
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/table";
import {Button} from "@/components/button";
import Filter from './_filter';
import Payments from "./_edit";

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
export default async function Page({searchParams}: Props) {
  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const page = Number(searchParams.page) > 0 ? Number(searchParams.page) : 1;
  const studentId = Number(searchParams.student);
  const from = searchParams.from ? new Date(searchParams.from) : new Date(0);
  const to = searchParams.to ? new Date(searchParams.to) : new Date(2040, 1, 1);
  const where = {
    deletedAt: null,
    ...(from ? {
      paidAt: {
        gte: from,
        lte: to,
      },
    } : {}),
    syllabus: {
      student: {
        ...(studentId ? {id: studentId} : {}),
        userId: user.id,
        deletedAt: null,
      },
    },
  }
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
      paidAt: "desc",
    },
  });
  const paymentsCount = await prisma.payment.count({
    where
  })

  const editingPayment = searchParams.edit
    ? payments.find((m) => m.id === Number(searchParams.edit))
    : null;

  return (
    <div>
      {payments.length > 0 && (
        <div className="mt-3">
          <Heading level={3}>요약</Heading>
          <DescriptionList>
            <DescriptionTerm>결제 건수</DescriptionTerm>
            <DescriptionDetails>{payments.length}건</DescriptionDetails>

            <DescriptionTerm>결제 금액</DescriptionTerm>
            <DescriptionDetails>
              {formatToKoreanNumber(payments.reduce((t, p) => t + p.amount, 0))}
              원
            </DescriptionDetails>
          </DescriptionList>
        </div>
      )}
      <Filter/>
      <Table className="mt-5">
        <TableHead>
          <TableRow>
            <TableHeader>일자</TableHeader>
            <TableHeader>결제수단</TableHeader>
            <TableHeader>금액</TableHeader>
            <TableHeader>학생명</TableHeader>
            <TableHeader>메모</TableHeader>
            <TableHeader>수정</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.length > 0 ? (
            <>
              {payments.map((payment: any) => (
                <TableRow key={`payment-${payment.id}`}>
                  <TableCell>
                    {format(new Date(payment.paidAt), "yyyy-MM-dd")}
                  </TableCell>
                  <TableCell>{payment.paymentMethod}</TableCell>
                  <TableCell>
                    {formatToKoreanNumber(payment.amount)}원
                  </TableCell>
                  <TableCell>{payment.syllabus.student.name}</TableCell>
                  <TableCell>{payment.notes}</TableCell>
                  <TableCell>
                    <Link
                      href={{
                        query: {
                          ...searchParams,
                          edit: payment.id,
                        },
                      }}
                    >
                      <Button plain>수정</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </>
          ) : (
            <TableRow>
              <TableCell className="text-center" colSpan={6}>
                입금 내역이 없어요
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="mt-10 flex justify-between">
        <div>
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
              <ChevronLeftIcon/>
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
                  ...searchParams,
                  page: page + 1,
                },
              }}
            >
              다음 페이지
              <ChevronRightIcon/>
            </Link>
          )}
        </div>
      </div>
      <Payments payment={editingPayment}/>
    </div>
  );
}
