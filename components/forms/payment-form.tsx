"use client";
import { format } from "date-fns/format";
import { formatToKoreanNumber } from "@toss/utils";

import React from "react";
import {
  BanknoteIcon,
  BookDashedIcon,
  CreditCardIcon,
  EllipsisVerticalIcon,
  LandmarkIcon,
} from "lucide-react";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@/components/dialog";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { Listbox, ListboxLabel, ListboxOption } from "@/components/listbox";
import { Text } from "@/components/text";
import { Textarea } from "@/components/textarea";
import {
  Dropdown,
  DropdownButton,
  DropdownDescription,
  DropdownHeading,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSection,
} from "@/components/dropdown";

export default function PaymentForm({ syllabus, onSuccess, onClose }: any) {
  const [isPending, setIsPending] = React.useState(false);

  const payment = syllabus?.payment;

  const onDelete = React.useCallback(async () => {
    setIsPending(true);
    const response = await fetch(`/api/syllabuses/${syllabus.id}/payment`, {
      method: "DELETE",
    });

    if (response.status === 204) {
      onSuccess();
    }

    setIsPending(false);
  }, [syllabus]);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      const response = await fetch(`/api/syllabuses/${syllabus.id}/payment`, {
        method: "PUT",
        body: formData,
      });

      // const result = await response.json();
      setIsPending(false);
      onSuccess();
      // console.log("gdgd", result);
    },
    [syllabus, onSuccess],
  );

  return (
    <Dialog open onClose={onClose}>
      <div className="flex items-center justify-between">
        <DialogTitle>입금내역</DialogTitle>
        {payment && (
          <Dropdown>
            <DropdownButton plain disabled={isPending}>
              <EllipsisVerticalIcon />
            </DropdownButton>
            <DropdownMenu>
              <DropdownSection>
                <DropdownHeading>삭제</DropdownHeading>
                <DropdownItem
                  className="data-[focus]:bg-red-300"
                  onClick={() => {
                    if (confirm("결제 이력을 삭제합니다")) {
                      onDelete();
                    }
                  }}
                >
                  <DropdownLabel className="text-red-600">
                    입금 내역 삭제
                  </DropdownLabel>
                  <DropdownDescription>
                    입금 내역을 삭제합니다
                  </DropdownDescription>
                </DropdownItem>
              </DropdownSection>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>
      <DialogBody>
        <form id="payment-form" onSubmit={onSubmit}>
          <FieldGroup>
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
                defaultValue={payment?.amount || 0}
                onChange={(event) => {
                  const target = event.target as HTMLInputElement;
                  // @ts-ignore
                  target.form.elements.namedItem("amount_p").value =
                    `${formatToKoreanNumber(Number(target.value))}원`;
                }}
              />
              <Text>
                <output name="amount_p" htmlFor="amount">
                  {payment ? `${formatToKoreanNumber(payment.amount)}원` : ""}
                </output>
              </Text>
            </Field>

            <Field>
              <Label>결제수단</Label>
              <Listbox
                name="paymentMethod"
                defaultValue={payment?.paymentMethod || "card"}
              >
                <ListboxOption value="card">
                  <CreditCardIcon width={20} height={20} strokeWidth={1.5} />
                  <ListboxLabel>카드</ListboxLabel>
                </ListboxOption>
                <ListboxOption value="transfer">
                  <LandmarkIcon width={20} height={20} strokeWidth={1.5} />
                  <ListboxLabel>계좌이체</ListboxLabel>
                </ListboxOption>
                <ListboxOption value="cash">
                  <BanknoteIcon width={20} height={20} strokeWidth={1.5} />
                  <ListboxLabel>현금</ListboxLabel>
                </ListboxOption>
                <ListboxOption value="none">
                  <BookDashedIcon width={20} height={20} strokeWidth={1.5} />
                  <ListboxLabel>미결제</ListboxLabel>
                </ListboxOption>
              </Listbox>
            </Field>

            <Field>
              <Label>메모</Label>
              <Textarea name="notes" defaultValue={payment?.notes} />
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogActions>
        {/* @ts-ignore */}
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
