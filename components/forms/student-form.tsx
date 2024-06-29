"use client";
import React from "react";
import { Button } from "@/components/button";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from "@/components/dialog";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Select } from "@/components/select";
import { LoaderIcon } from "lucide-react";

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
      const formData = new FormData(event.target as HTMLFormElement);
      const response = student
        ? await fetch(`/api/students/${student.id}`, {
            method: "PUT",
            body: formData,
          })
        : await fetch("/api/students", {
            method: "POST",
            body: formData,
          });
      const result = await response.json();
      setIsPending(false);
      onSuccess();
    },
    [student, onSuccess],
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
              <Label>상태</Label>
              <Select name="status" defaultValue={student?.status || "active"}>
                <option value="active">수강중</option>
                <option value="paused">일시정지</option>
                <option value="dropped">그만둠</option>
              </Select>
            </Field>
            <Field>
              <Label>참고사항</Label>
              <Textarea name="notes" defaultValue={student?.notes} rows={5} />
            </Field>
          </FieldGroup>
        </form>
      </DialogBody>
      <DialogActions>
        <Button plain disabled={isPending} onClick={onClose}>
          닫기
        </Button>
        <Button type="submit" form={formId} disabled={isPending}>
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
