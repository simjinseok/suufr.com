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
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "@/components/description-list";
import { Textarea } from "@/components/textarea";

export default function FeedbackForm({ lesson, onSuccess, onClose }: any) {
  const formId = React.useId();
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      let response = lesson.feedback
        ? await fetch(
            `/api/lessons/${lesson.id}/feedback/${lesson.feedback.id}`,
            {
              method: "PUT",
              body: formData,
            },
          )
        : await fetch(`/api/lessons/${lesson.id}/feedback`, {
            method: "POST",
            body: formData,
          });

      const result = await response.json();
      setIsPending(false);
      onSuccess();
      // console.log("gdgd", result);
    },
    [lesson, onSuccess],
  );

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>피드백</DialogTitle>
      <DialogBody>
        <form id={formId} onSubmit={onSubmit}>
          <FieldGroup>
            <DescriptionList>
              <DescriptionTerm>수강생</DescriptionTerm>
              <DescriptionDetails>{lesson.student.name}</DescriptionDetails>

              <DescriptionTerm>레슨 일시</DescriptionTerm>
              <DescriptionDetails>
                {format(new Date(lesson.lessonAt), "yyyy-MM-dd HH:mm")}
              </DescriptionDetails>

              <DescriptionTerm>레슨 내용</DescriptionTerm>
              <DescriptionDetails>{lesson.notes}</DescriptionDetails>
            </DescriptionList>

            <Field>
              <Label>내용</Label>
              <Textarea name="notes" defaultValue={lesson?.feedback?.notes} />
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
