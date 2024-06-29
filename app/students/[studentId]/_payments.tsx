"use client";
import type { TPayment, TStudent } from "@/types/index";

import { format } from "date-fns";
import { formatToKoreanNumber } from "@toss/utils";

import React from "react";
import { useRouter } from "next/navigation";
import { Heading } from "@/components/heading";
import { Button } from "@/components/button";
import PaymentForm from "@/components/payment-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";

type Props = {
  student: TStudent;
  payments: TPayment[];
};
export default function Payments({ student, payments }: Props) {
  const router = useRouter();
  const [isCreating, setIsCreating] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState<TPayment | null>(null);

  return (
    <div className="mt-10">
      <div className="flex items-end justify-between">
        <Heading level={2}>입금내역</Heading>
        <Button color="emerald" onClick={() => setIsCreating(true)}>
          추가
        </Button>
      </div>
      {Array.isArray(payments) && payments.length > 0 ? (
        <Table className="mt-5">
          <TableHead>
            <TableRow>
              <TableHeader>일자</TableHeader>
              <TableHeader>금액</TableHeader>
              <TableHeader>메모</TableHeader>
              <TableHeader>수정</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={`payment-${payment.id}`}>
                <TableCell>{format(payment.paidAt, "yyyy-MM-dd")}</TableCell>
                <TableCell>{formatToKoreanNumber(payment.amount)}원</TableCell>
                <TableCell className="whitespace-pre">
                  {payment.notes}
                </TableCell>
                <TableCell>
                  <Button
                    color="white"
                    onClick={setEditingPayment.bind(null, payment)}
                  >
                    수정
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div>입금내역이 없습니다</div>
      )}

      {(isCreating || editingPayment) && (
        <PaymentForm
          student={student}
          payment={editingPayment}
          onSuccess={() => {
            setIsCreating(false);
            setEditingPayment(null);
            router.refresh();
          }}
          onClose={() => {
            setIsCreating(false);
            setEditingPayment(null);
          }}
        />
      )}
    </div>
  );
}
