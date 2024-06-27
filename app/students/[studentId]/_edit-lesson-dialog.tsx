"use client";
import { format } from "date-fns/format";

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@/components/dialog";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";

export default function EditLessonDialog({ lesson, onClose }: any) {
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsPending(true);

      const response = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PUT",
        body: new FormData(event.target as HTMLFormElement),
      });
      const result = await response.json();
      alert("수정되었습니다.");
      setIsPending(false);
      console.log(result);
    },
    [lesson],
  );

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>일정 수정</DialogTitle>
      <DialogBody>
        <form id="edit-lesson-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <Label>날짜</Label>
              <Input
                type="datetime-local"
                name="lessonAt"
                disabled={isPending}
                defaultValue={format(
                  new Date(lesson.lessonAt),
                  "yyyy-MM-dd HH:mm",
                )}
              />
            </Field>

            <Field>
              <Label>노트</Label>
              <Textarea
                name="notes"
                disabled={isPending}
                defaultValue={lesson.notes}
              />
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogActions>
        <div className="mr-auto">
          <Button color="red" disabled={isPending}>
            삭제
          </Button>
        </div>
        <Button color="white" plain disabled={isPending} onClick={onClose}>
          닫기
        </Button>
        <Button type="submit" form="edit-lesson-form" disabled={isPending}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
