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
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";

export default function LessonForm({
  syllabus,
  lesson,
  onSuccess,
  onClose,
}: any) {
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      const response = lesson
        ? await fetch(`/api/lessons/${lesson.id}`, {
            method: "PUT",
            body: formData,
          })
        : await fetch("/api/lessons", {
            method: "POST",
            body: formData,
          });

      // const result = await response.json();
      setIsPending(false);
      onSuccess();
      // console.log("gdgd", result);
    },
    [lesson, onSuccess],
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
              <Label>날짜</Label>
              <Input
                type="datetime-local"
                name="lessonAt"
                defaultValue={format(
                  lesson ? lesson.lessonAt : new Date(),
                  "yyyy-MM-dd HH:mm",
                )}
              />
            </Field>

            <Field>
              <Label>메모</Label>
              <Textarea name="notes" defaultValue={lesson?.notes} />
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
