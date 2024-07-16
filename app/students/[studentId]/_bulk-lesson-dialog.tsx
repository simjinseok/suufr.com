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
import { format } from "date-fns/format";
import { Button } from "@/components/button";

export default function BulkLessonDialog({
  syllabus,
  onSuccess,
  onClose,
}: any) {
  const formId = React.useId();
  const [lessonsDate, setLessonsDate] = React.useState<any[]>([]);
  const [isPending, setIsPending] = React.useState(false);

  const onChange = React.useCallback((event: React.ChangeEvent) => {
    const formElement = (event.target as HTMLInputElement)
      .form as HTMLFormElement;
    const arr = [];

    let cnt = Number(
      (formElement.elements.namedItem("lesson_count") as HTMLInputElement)
        .value,
    );
    let id = 1;
    const [year, month, date] = (
      formElement.elements.namedItem("lesson_date") as HTMLInputElement
    ).value.split("-");
    const [hour, minutes] = (
      formElement.elements.namedItem("lesson_time") as HTMLInputElement
    ).value.split(":");
    const day = [
      (formElement.elements.namedItem("lesson_sunday") as HTMLInputElement)
        .checked,
      (formElement.elements.namedItem("lesson_monday") as HTMLInputElement)
        .checked,
      (formElement.elements.namedItem("lesson_tuesday") as HTMLInputElement)
        .checked,
      (formElement.elements.namedItem("lesson_wednesday") as HTMLInputElement)
        .checked,
      (formElement.elements.namedItem("lesson_thursday") as HTMLInputElement)
        .checked,
      (formElement.elements.namedItem("lesson_friday") as HTMLInputElement)
        .checked,
      (formElement.elements.namedItem("lesson_saturday") as HTMLInputElement)
        .checked,
    ];
    const baseDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(date),
      Number(hour),
      Number(minutes),
    );
    if (!day.some((d: boolean) => d)) {
      return setLessonsDate([]);
    }

    for (let d = 1; cnt > 0; d++) {
      const currentDate = new Date(
        baseDate.getTime() + 1000 * 60 * 60 * 24 * (d - 1),
      );

      if (day[currentDate.getDay()]) {
        arr.push(
          new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
            currentDate.getHours(),
            currentDate.getMinutes(),
          ),
        );
        cnt -= 1;
        id += 1;
      }
    }
    setLessonsDate(arr);
  }, []);

  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.target as HTMLFormElement);

      setIsPending(true);
      fetch("/api/lessons", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (response.status === 201) {
            alert("일정이 추가되었습니다");
            onSuccess();
          }
        })
        .finally(() => {
          setIsPending(false);
        });
    },
    [onSuccess],
  );
  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>여러개의 일정 추가</DialogTitle>
      <DialogBody>
        <form id={formId} onSubmit={onSubmit}>
          <input type="hidden" name="syllabusId" value={syllabus.id} />
          <div className="mt-5 border rounded p-5">
            <p>수업</p>
            <div className="flex items-start gap-3">
              <div>
                <label>기준 날짜</label>
                <div className="flex gap-3">
                  <Input
                    type="date"
                    name="lesson_date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    className="w-fit"
                    onChange={onChange}
                  />
                  <Input
                    type="time"
                    name="lesson_time"
                    className="w-fit"
                    defaultValue={format(new Date(), "HH:mm")}
                    onChange={onChange}
                  />
                </div>
              </div>
              <div className="shrink mt-0">
                <label>횟수</label>
                <div>
                  <Input
                    type="number"
                    name="lesson_count"
                    min={1}
                    defaultValue={4}
                    onChange={onChange}
                    className="w-fit"
                  />
                </div>
              </div>
            </div>
            <FieldGroup>
              <Field className="mt-3">
                <div className="flex justify-between">
                  <label className="flex flex-col">
                    <input
                      type="checkbox"
                      name="lesson_sunday"
                      onChange={onChange}
                    />
                    일요일
                  </label>

                  <label className="flex flex-col">
                    <input
                      type="checkbox"
                      name="lesson_monday"
                      onChange={onChange}
                    />
                    월요일
                  </label>

                  <label className="flex flex-col">
                    <input
                      type="checkbox"
                      name="lesson_tuesday"
                      onChange={onChange}
                    />
                    화요일
                  </label>

                  <label className="flex flex-col">
                    <input
                      type="checkbox"
                      name="lesson_wednesday"
                      onChange={onChange}
                    />
                    수요일
                  </label>
                  <label className="flex flex-col">
                    <input
                      type="checkbox"
                      name="lesson_thursday"
                      onChange={onChange}
                    />
                    목요일
                  </label>

                  <label className="flex flex-col">
                    <input
                      type="checkbox"
                      name="lesson_friday"
                      onChange={onChange}
                    />
                    금요일
                  </label>

                  <label className="flex flex-col">
                    <input
                      type="checkbox"
                      name="lesson_saturday"
                      onChange={onChange}
                    />
                    토요일
                  </label>
                </div>
              </Field>

              {lessonsDate.map((date, idx) => (
                <Field key={date}>
                  <Label>{idx + 1}회차</Label>
                  <Input
                    name="lessonAt"
                    type="datetime-local"
                    value={format(date, "yyyy-MM-dd HH:mm")}
                    readOnly
                  />
                </Field>
              ))}
            </FieldGroup>
          </div>
        </form>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isPending}>
          닫기
        </Button>
        <Button type="submit" disabled={isPending} form={formId}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
