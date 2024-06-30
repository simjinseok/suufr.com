"use client";
import type { TStudent } from "@/types/index";

import React from "react";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from "@/components/dialog";
import { Field, FieldGroup, Label } from "@/components/fieldset";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Button } from "@/components/button";
import { SaveIcon, Trash2Icon, LoaderIcon } from "lucide-react";

export default function EditDialog({
  student,
  onClose,
}: { student: TStudent; onClose: () => void }) {
  const [isPending, setIsPending] = React.useState(false);
  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setIsPending(true);
      const response = await fetch(`/api/students/${student.id}`, {
        method: "PUT",
        body: new FormData(event.target as HTMLFormElement),
      });

      setIsPending(false);
      alert("수정이 완료되었습니다");
    },
    [student],
  );

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>{student.name}</DialogTitle>
      <DialogBody>
        <form id="student-edit-form" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <Label>이름</Label>
              <Input
                name="name"
                form="student-edit-form"
                defaultValue={student.name}
              />
            </Field>
            <Field>
              <Label>참고사항</Label>
              <Textarea
                name="notes"
                form="student-edit-form"
                defaultValue={student.notes}
                rows={5}
              />
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogActions>
        <div className="mr-auto">
          <Button color="red" disabled={isPending}>
            <Trash2Icon width={16} height={16} />
            삭제
          </Button>
        </div>

        <Button color="white" onClick={onClose} disabled={isPending}>
          닫기
        </Button>
        <Button type="submit" form="student-edit-form" disabled={isPending}>
          <SaveIcon width={16} height={16} />
          저장
          {isPending && (
            <div className="absolute inset-0 bg-[inherit] rounded-[inherit] flex items-center justify-center">
              <LoaderIcon className="animate-spin" />
            </div>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
