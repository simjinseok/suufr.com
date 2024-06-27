"use client";
import { format } from "date-fns/format";
import { commaizeNumber } from "@toss/utils";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import PaymentForm from "@/components/payment-form";
import {router} from "next/client";

export default function Payments({ payments }: any) {
  const router = useRouter();
  const [editingPayment, setEditingPayment] = React.useState<any>(null);

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>일자</TableHeader>
            <TableHeader>금액</TableHeader>
            <TableHeader>학생명</TableHeader>
            <TableHeader>수정</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((payment: any) => (
            <TableRow key={`payment-${payment.id}`}>
              <TableCell>
                {format(new Date(payment.paidAt), "yyyy-MM-dd")}
              </TableCell>
              <TableCell>{commaizeNumber(payment.amount)}원</TableCell>
              <TableCell>{payment.student.name}</TableCell>
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
      {editingPayment && (
        <PaymentForm
          student={editingPayment.student}
          payment={editingPayment}
          onSuccess={() => {
            router.refresh();
            setEditingPayment(false);
          }}
          onClose={setEditingPayment.bind(null, false)}
        />
      )}
    </>
  );
}
