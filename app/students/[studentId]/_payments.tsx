"use client";
import { format } from "date-fns";
import { formatToKoreanNumber } from "@toss/utils";

import React from "react";
import { useRouter } from "next/navigation";
import { Heading } from "@/components/heading";
import { Button } from "@/components/button";
import { Divider } from "@/components/divider";
import PaymentForm from "@/components/payment-form";
import { Text } from "@/components/text";

export default function Payments({ student, payments }: any) {
  const router = useRouter();
  const [isCreating, setIsCreating] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState(null);

  return (
    <div className="mt-10">
      <div className="flex items-end justify-between">
        <Heading level={2}>입금내역</Heading>
        <Button color="emerald" onClick={() => setIsCreating(true)}>
          추가
        </Button>
      </div>
      <Divider className="my-3" />
      {Array.isArray(payments) && payments.length > 0 ? (
        <ul>
          {payments.map((payment) => (
            <li
              key={`payment-${payment.id}`}
              className="flex items-center gap-5"
            >
              <div>
                <p>{format(new Date(payment.paidAt), "yyyy-MM-dd")}</p>
                <Text>{formatToKoreanNumber(payment.amount)}원</Text>
              </div>
              <div>
                <Button onClick={setEditingPayment.bind(null, payment)}>
                  수정
                </Button>
              </div>
            </li>
          ))}
        </ul>
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
