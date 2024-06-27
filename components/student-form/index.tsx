"use client";
import React from "react";
import { Button } from "@/components/button";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "@/components/dialog";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Save as SaveIcon, Trash2 as Trash2Icon } from "lucide-react";

export default function NewStudentModal({
  student,
  isOpen,
  onSuccess,
  onClose,
}: any) {
    const formId = React.useId();
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setIsPending(true);
      const response = await fetch("/api/students", {
        method: "POST",
        body: new FormData(event.target as HTMLFormElement),
      });
      const result = await response.json();
      setIsPending(false);
      onSuccess();
    },
    [onSuccess],
  );

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>수강생 추가</DialogTitle>
      <DialogBody>
        <form id={formId} onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <Label>이름</Label>
              <Input name="name" defaultValue={student?.name} required />
            </Field>
            <Field>
              <Label>참고사항</Label>
              <Textarea name="notes" defaultValue={student?.notes} rows={5} />
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogActions>
        <Button color="white" disabled={isPending} onClick={onClose}>
          닫기
        </Button>
        <Button type="submit" form={formId} disabled={isPending}>
          <SaveIcon width={16} height={16} />
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
