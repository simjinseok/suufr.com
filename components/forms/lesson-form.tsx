"use client";
import {format} from "date-fns/format";

import React from "react";
import {Button} from "@/components/button";
import {
    Dialog,
    DialogTitle,
    DialogBody,
    DialogActions,
} from "@/components/dialog";
import {FieldGroup, Field, Label} from "@/components/fieldset";
import {Input} from "@/components/input";
import {Textarea} from "@/components/textarea";
import {
    Dropdown,
    DropdownButton,
    DropdownHeading,
    DropdownItem,
    DropdownLabel,
    DropdownDescription,
    DropdownMenu,
    DropdownSection,
} from "@/components/dropdown";
import {EllipsisVerticalIcon} from "lucide-react";
import {Checkbox, CheckboxField} from "@/components/checkbox";

export default function LessonForm({
                                       syllabus,
                                       lesson,
                                       onSuccess,
                                       onClose,
                                   }: any) {
    const [isPending, setIsPending] = React.useState(false);

    const onDelete = React.useCallback(async () => {
        setIsPending(true);
        const response = await fetch(`/api/lessons/${lesson.id}`, {
            method: "DELETE",
        });

        setIsPending(false);
        if (response.status === 204) {
            onSuccess();
        }
    }, [lesson, onSuccess]);

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
            <div className="flex items-center justify-between">
                <DialogTitle>{lesson ? "레슨 정보 수정" : "레슨 추가"}</DialogTitle>
                {lesson && (
                    <Dropdown>
                        <DropdownButton plain disabled={isPending}>
                            <EllipsisVerticalIcon/>
                        </DropdownButton>
                        <DropdownMenu>
                            <DropdownSection>
                                <DropdownHeading>삭제</DropdownHeading>
                                <DropdownItem
                                    className="data-[focus]:bg-red-300"
                                    onClick={() => {
                                        if (confirm("수업을 삭제합니다")) {
                                            onDelete();
                                        }
                                    }}
                                >
                                    <DropdownLabel className="text-red-600">
                                        수업 삭제
                                    </DropdownLabel>
                                    <DropdownDescription>
                                        해당 수업을 삭제합니다.
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
                        {syllabus && (
                            <input type="hidden" name="syllabusId" value={syllabus.id}/>
                        )}
                        {lesson && (
                            <CheckboxField>
                                <Checkbox name="isDone" defaultChecked={lesson.isDone}/>
                                <Label>완료여부</Label>
                            </CheckboxField>
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
                            <Textarea name="notes" defaultValue={lesson?.notes}/>
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
