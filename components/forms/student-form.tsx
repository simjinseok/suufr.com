"use client";
import React from "react";
import { EllipsisVerticalIcon, LoaderIcon } from "lucide-react";
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
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "@/components/dropdown";

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

  const onDelete = React.useCallback(() => {
    if (!confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    setIsPending(true);
    fetch(`/api/students/${student.id}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (response.status === 204) {
          alert("삭제되었습니다");
          location.pathname = "/students";
        }
      })
      .finally(() => {
        setIsPending(false);
      });
  }, [student]);

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="flex justify-between">
        <DialogTitle>수강생</DialogTitle>
        <Dropdown>
          <DropdownButton plain disabled={isPending}>
            <EllipsisVerticalIcon />
          </DropdownButton>
          <DropdownMenu>
            <DropdownItem className="text-red-500 font-bold" onClick={onDelete}>
              삭제
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      <DialogBody>
        <form id={formId} onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <Label>이름</Label>
              <Input
                name="name"
                defaultValue={student?.name}
                readOnly={isPending}
                required
              />
            </Field>
            <Field>
              <Label>상태</Label>
              <Select
                name="status"
                defaultValue={student?.status || "active"}
                disabled={isPending}
              >
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
