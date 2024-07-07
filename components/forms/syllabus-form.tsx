"use client";
import type { TSyllabus } from "@/types/index";

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
import { Textarea } from "@/components/textarea";

type Props = {
  syllabus: TSyllabus;
  onSuccess: () => void;
  onClose: () => void;
};
export default function SyllabusForm({ syllabus, onSuccess, onClose }: Props) {
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      const response = await fetch(`/api/syllabuses/${syllabus.id}`, {
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
      <DialogTitle>레슨정보 수정</DialogTitle>
      <DialogBody>
        <form id="payment-form" onSubmit={onSubmit}>
          <FieldGroup>
            {syllabus && (
              <input type="hidden" name="studentId" value={syllabus.id} />
            )}
            <Field>
              <Label>제목</Label>
              <Input name="title" defaultValue={syllabus.title} />
            </Field>

            <Field>
              <Label>메모</Label>
              <Textarea name="notes" defaultValue={syllabus.notes} />
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
