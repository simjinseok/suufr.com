"use client";
import type { TStudent, TSyllabus } from "@/types/index";

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
import { EllipsisVerticalIcon } from "lucide-react";

type Props = {
  student?: TStudent;
  syllabus?: TSyllabus;
  onSuccess: () => void;
  onClose: () => void;
};
export default function SyllabusForm({
  student,
  syllabus,
  onSuccess,
  onClose,
}: Props) {
  const [isPending, setIsPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      const response = syllabus
        ? await fetch(`/api/syllabuses/${syllabus.id}`, {
            method: "PUT",
            body: formData,
          })
        : await fetch("/api/syllabuses", {
            method: "POST",
            body: formData,
          });

      // const result = await response.json();
      setIsPending(false);
      onSuccess();
      // console.log("gdgd", result);
    },
    [syllabus, onSuccess],
  );

  const onDelete = React.useCallback(async () => {
    if (!syllabus) {
      return;
    }

    if (confirm("계획을 삭제합니다")) {
      setIsPending(true);
      const response = await fetch(`/api/syllabuses/${syllabus.id}`, {
        method: "DELETE",
      });
        setIsPending(false);
      if (response.status === 204) {
        return onSuccess();
      }

      const error = await response.json();
      alert(error.message);
    }
  }, [syllabus]);

  return (
    <Dialog open onClose={onClose}>
      <div className="flex items-center justify-between">
        <DialogTitle>계획</DialogTitle>
        {syllabus && (
          <Dropdown>
            <DropdownButton plain disabled={isPending}>
              <EllipsisVerticalIcon />
            </DropdownButton>
            <DropdownMenu>
              <DropdownSection>
                <DropdownHeading>삭제</DropdownHeading>
                <DropdownItem
                  className="data-[focus]:bg-red-300"
                  onClick={onDelete}
                >
                  <DropdownLabel className="text-red-600">
                    계획 삭제
                  </DropdownLabel>
                  <DropdownDescription>
                    해당 계획을 삭제합니다.
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
            {student && (
              <input type="hidden" name="studentId" value={student.id} />
            )}
            <Field>
              <Label>제목</Label>
              <Input name="title" defaultValue={syllabus?.title} />
            </Field>

            <Field>
              <Label>메모</Label>
              <Textarea name="notes" defaultValue={syllabus?.notes} />
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
