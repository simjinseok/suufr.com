"use client";
import { format } from "date-fns/format";
import { formatToKoreanNumber } from "@toss/utils";

import React from "react";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@/components/dialog";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { Text } from "@/components/text";
import { Textarea } from "@/components/textarea";

export default function PaymentForm({
  student,
  payment,
  onSuccess,
  onClose,
}: any) {
  const isEdit = !!payment;

  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      let response = isEdit
        ? await fetch(`/api/payments/${payment.id}`, {
            method: "PUT",
            body: formData,
          })
        : await fetch("/api/payments", {
            method: "POST",
            body: formData,
          });

      const result = await response.json();
      setIsPending(false);
      onSuccess();
      // console.log("gdgd", result);
    },
    [isEdit, payment],
  );

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>입금내역</DialogTitle>
      <DialogBody>
        <form id="payment-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <Label>수강생</Label>
              <Input type="text" value={student.name} readOnly />
            </Field>
            <input type="hidden" name="studentId" value={student.id} />
            <Field>
              <Label>날짜</Label>
              <Input
                type="date"
                name="paidAt"
                defaultValue={format(
                  payment ? new Date(payment.paidAt) : new Date(),
                  "yyyy-MM-dd",
                )}
              />
            </Field>

            <Field>
              <Label>금액</Label>
              <Input
                type="number"
                name="amount"
                defaultValue={payment?.amount}
                onChange={(event) => {
                  event.target.form.elements.namedItem("amount_p").value =
                    `${formatToKoreanNumber(event.target.value)}원`;
                }}
              />
              <Text>
                <output name="amount_p" htmlFor="amount">
                    {payment ? `${formatToKoreanNumber(payment.amount)}원` : ''}
                </output>
              </Text>
            </Field>

            <Field>
              <Label>메모</Label>
              <Textarea name="notes" defaultValue={payment?.notes} />
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogActions>
        <Button color="white" plain onClick={onClose} disabled={isPending}>
          닫기
        </Button>
        <Button
          type="submit"
          form="payment-form"
          color="emerald"
          disabled={isPending}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
