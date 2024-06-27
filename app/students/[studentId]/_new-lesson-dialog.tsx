"use client";
import { format } from "date-fns/format";

import React from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogTitle,
  DialogBody,
  DialogActions,
} from "@/components/dialog";
import { CheckboxGroup, Checkbox, CheckboxField } from "@/components/checkbox";
import { FieldGroup, Field, Label } from "@/components/fieldset";
import { Input } from "@/components/input";

export default function NewStudentModal({ onClose }: any) {
  const params = useParams();
  const [generatorFields, setGeneratorFields] = React.useState<any>({
    date: new Date(),
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    // date: new Date().getDate(),
    hour: new Date().getHours(),
    minute: new Date().getMinutes(),
    day: [0, 0, 0, 0, 0, 0, 0], // 일요일 ~ 토요일
    count: 4,
  });
  const [lessons, setLessons] = React.useState<any[]>([]);

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>일정 추가</DialogTitle>
      <DialogBody>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            fetch(`/api/students/${params.studentId}`, {
              method: "POST",
              body: new FormData(event.target as HTMLFormElement),
            }).then((response) => {
              if (response.status === 201) {
                alert("수업이 추가되었습니다.");
                location.reload();
              }
            });
          }}
        >
          <div className="mt-3">
            {lessons.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {lessons
                  .sort((a, b) => (a.date - b.date > 0 ? 1 : -1))
                  .map((lesson, idx) => (
                    <li key={`lesson-${lesson.id}`} className="">
                      <Field>
                        <Label>{idx + 1}회차 날짜</Label>
                        <Input
                          name="lessonAt"
                          type="datetime-local"
                          defaultValue={format(lesson.date, "yyyy-MM-dd HH:mm")}
                          onChange={(date) => {
                            setLessons((prev) => {
                              const arr = [...prev];
                              const currentLesson = prev.find(
                                (l) => l.id === lesson.id,
                              );
                              currentLesson.date = new Date(date.target.value);
                              return arr;
                            });
                          }}
                        />
                      </Field>
                    </li>
                  ))}
                <li className="mt-3">
                  <Button
                    className="w-full"
                    onClick={() =>
                      setLessons((prev) => [
                        ...prev,
                        {
                          id: lessons.length + 1,
                          notes: "",
                          date: new Date(),
                        },
                      ])
                    }
                  >
                    추가
                  </Button>
                </li>
              </ul>
            ) : (
              <div>
                <FieldGroup>
                  <Field>
                    <Label>기준 날짜</Label>
                    <div className="flex gap-3">
                      <Input
                        type="date"
                        value={format(generatorFields.date, "yyyy-MM-dd")}
                        className="w-fit"
                        onChange={(event) => {
                          const dateArr = event.target.value.split("-");

                          setGeneratorFields((prev: any) => {
                            const date = prev.date;
                            date.setFullYear(dateArr[0]);
                            date.setMonth(dateArr[1]);
                            date.setDate(dateArr[2]);
                            return {
                              ...prev,
                              date,
                            };
                          });
                        }}
                      />
                      <Input
                        type="time"
                        className="w-fit"
                        value={format(generatorFields.date, "HH:mm")}
                        onChange={(event) => {
                          const timeArr = event.target.value.split(":");
                          setGeneratorFields((prev: any) => ({
                            ...prev,
                            hour: timeArr[0],
                            minute: timeArr[1],
                          }));
                        }}
                      />
                    </div>
                  </Field>

                  <Field>
                    <Label>요일</Label>
                    <CheckboxGroup>
                      <CheckboxField>
                        <Checkbox
                          onChange={(isChecked) => {
                            setGeneratorFields((prev: any) => ({
                              ...prev,
                              day: prev.day.map((d: number, i: number) =>
                                i === 0 ? (isChecked ? 1 : 0) : d,
                              ),
                            }));
                          }}
                        />
                        <Label>일요일</Label>
                      </CheckboxField>

                      <CheckboxField>
                        <Checkbox
                          onChange={(isChecked) => {
                            setGeneratorFields((prev: any) => ({
                              ...prev,
                              day: prev.day.map((d: number, i: number) =>
                                i === 1 ? (isChecked ? 1 : 0) : d,
                              ),
                            }));
                          }}
                        />
                        <Label>월요일</Label>
                      </CheckboxField>

                      <CheckboxField>
                        <Checkbox
                          onChange={(isChecked) => {
                            setGeneratorFields((prev: any) => ({
                              ...prev,
                              day: prev.day.map((d: number, i: number) =>
                                i === 2 ? (isChecked ? 1 : 0) : d,
                              ),
                            }));
                          }}
                        />
                        <Label>화요일</Label>
                      </CheckboxField>

                      <CheckboxField>
                        <Checkbox
                          onChange={(isChecked) => {
                            setGeneratorFields((prev: any) => ({
                              ...prev,
                              day: prev.day.map((d: number, i: number) =>
                                i === 3 ? (isChecked ? 1 : 0) : d,
                              ),
                            }));
                          }}
                        />
                        <Label>수요일</Label>
                      </CheckboxField>

                      <CheckboxField>
                        <Checkbox
                          onChange={(isChecked) => {
                            setGeneratorFields((prev: any) => ({
                              ...prev,
                              day: prev.day.map((d: number, i: number) =>
                                i === 4 ? (isChecked ? 1 : 0) : d,
                              ),
                            }));
                          }}
                        />
                        <Label>목요일</Label>
                      </CheckboxField>

                      <CheckboxField>
                        <Checkbox
                          onChange={(isChecked) => {
                            setGeneratorFields((prev: any) => ({
                              ...prev,
                              day: prev.day.map((d: number, i: number) =>
                                i === 5 ? (isChecked ? 1 : 0) : d,
                              ),
                            }));
                          }}
                        />
                        <Label>금요일</Label>
                      </CheckboxField>

                      <CheckboxField>
                        <Checkbox
                          onChange={(isChecked) => {
                            setGeneratorFields((prev: any) => ({
                              ...prev,
                              day: prev.day.map((d: number, i: number) =>
                                i === 6 ? (isChecked ? 1 : 0) : d,
                              ),
                            }));
                          }}
                        />
                        <Label>토요일</Label>
                      </CheckboxField>
                    </CheckboxGroup>
                  </Field>

                  <Field>
                    <Label>횟수</Label>
                    <Input
                      type="number"
                      value={generatorFields.count}
                      onChange={(event) => {
                        setGeneratorFields((prev: any) => ({
                          ...prev,
                          count: event.target.value,
                        }));
                      }}
                      className="w-fit"
                    />
                  </Field>

                  <Button
                    onClick={() => {
                      let cnt = generatorFields.count;
                      let id = 1;
                      const date = new Date();
                      const arr = [];
                      for (let d = 1; cnt > 0; d++) {
                        const currentDate = new Date(
                          date.getTime() + 1000 * 60 * 60 * 24 * d,
                        );

                        if (!generatorFields.day.some((d: number) => d === 1)) {
                          alert("요일을 선택해주세요");
                          return;
                        }
                        if (generatorFields.day[currentDate.getDay()]) {
                          arr.push({
                            id,
                            notes: "",
                            date: new Date(
                              currentDate.getFullYear(),
                              currentDate.getMonth(),
                              currentDate.getDate(),
                              currentDate.getHours(),
                              currentDate.getMinutes(),
                            ),
                          });
                          cnt -= 1;
                          id += 1;
                        }
                      }
                      setLessons(arr);
                    }}
                  >
                    일정 생성
                  </Button>
                </FieldGroup>
              </div>
            )}
          </div>
        </form>
      </DialogBody>
      <DialogActions>
        {/* @ts-ignore */}
        <Button color="white" plain onClick={onClose}>
          닫기
        </Button>
        <Button type="submit" color="emerald">
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
