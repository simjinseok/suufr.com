import { createClient } from "@/utils/supabase";
import { PrismaClient } from "@prisma/client";
import { format } from "date-fns/format";
import { formatToKoreanNumber } from "@toss/utils";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "@/components/description-list";
import Payments from "./_edit";
import { Heading } from "@/components/heading";
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/table";
import React from "react";
import { Button } from "@/components/button";

export default async function Page({
  searchParams,
}: { searchParams: { date: string; edit: string } }) {
  const date = new Date(searchParams.date || Date.now());

  const prisma = new PrismaClient();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const payments = await prisma.payment.findMany({
    include: {
      syllabus: {
        include: {
          student: true,
        },
      },
    },
    where: {
      deletedAt: null,
      paidAt: {
        gte: new Date(date.getFullYear(), date.getMonth(), 1),
        lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      },
      syllabus: {
        student: {
          userId: user.id,
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  const editingPayment = searchParams.edit
    ? payments.find((m) => m.id === Number(searchParams.edit))
    : null;

    console.log(editingPayment);
  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <Link
          href={{
            query: {
              date: format(
                new Date(date.getFullYear(), date.getMonth() - 1),
                "yyyy-MM",
              ),
            },
          }}
        >
          <ChevronLeftIcon width={20} height={20} strokeWidth={1.5} />
        </Link>
        <p className="text-lg font-bold">{format(date, "yyyy-MM")}</p>
        <Link
          href={{
            query: {
              date: format(
                new Date(date.getFullYear(), date.getMonth() + 1),
                "yyyy-MM",
              ),
            },
          }}
        >
          <ChevronRightIcon width={20} height={20} strokeWidth={1.5} />
        </Link>
      </div>
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
      <Payments payment={editingPayment} />
    </div>
  );
}
