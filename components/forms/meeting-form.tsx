"use client";
import { format } from "date-fns/format";

import React from "react";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@/components/dialog";
import { Input } from "@/components/input";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Textarea } from "@/components/textarea";
import { Checkbox, CheckboxField } from "@/components/checkbox";

export default function FeedbackForm({ meeting, onSuccess, onClose }: any) {
  const formId = React.useId();
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);
      formData.set("meetingAt", `${formData.get("meetingAt")}:00+09:00`);

      setIsPending(true);
      const response = meeting
        ? await fetch(`/api/meetings/${meeting.id}`, {
            method: "PUT",
            body: formData,
          })
        : await fetch("/api/meetings", {
            method: "POST",
            body: formData,
          });

      const result = await response.json();
      setIsPending(false);
      onSuccess();
      // console.log("gdgd", result);
    },
    [meeting, onSuccess],
  );

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>상담</DialogTitle>
      <DialogBody>
        <form id={formId} onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <Label>이름</Label>
              <Input name="name" defaultValue={meeting?.name} />
            </Field>

            <Field>
              <Label>날짜</Label>
              <Input
                type="datetime-local"
                name="meetingAt"
                defaultValue={format(
                  meeting?.meetingAt || new Date(),
                  "yyyy-MM-dd HH:mm",
                )}
              />
            </Field>

            <Field>
              <Label>연락처</Label>
              <Input type="tel" name="phone" />
            </Field>

            <CheckboxField>
              <Label>완료 여부</Label>
              <Checkbox name="isDone" defaultChecked={meeting?.isDone} />
            </CheckboxField>

            <Field>
              <Label>내용</Label>
              <Textarea name="notes" defaultValue={meeting?.notes} />
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isPending}>
          닫기
        </Button>
        <Button
          type="submit"
          form={formId}
          color="emerald"
          disabled={isPending}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
