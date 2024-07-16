"use client";
import type { TLesson, TStudent, TSyllabus } from "@/types/index";

import { format } from "date-fns/format";
import { formatToKoreanNumber } from "@toss/utils";

import React from "react";
import dynamic from "next/dynamic";
import {
  CircleIcon,
  CircleCheckBigIcon,
  EllipsisVerticalIcon,
} from "lucide-react";
import { Button } from "@/components/button";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHeading,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSection,
} from "@/components/dropdown";
import { useRouter } from "next/navigation";
import { Text } from "@/components/text";
import { Divider } from "@/components/divider";
import SyllabusForm from "@/components/forms/syllabus-form";
import PaymentForm from "@/components/forms/payment-form";
import FeedbackForm from "@/components/forms/feedback-form";
import BulkLessonDialog from "./_bulk-lesson-dialog";

const PAYMENT_METHODS = {
  card: "카드",
  transfer: "계좌이체",
  cash: "현금",
  none: "미지정",
};
const LessonForm = dynamic(() => import("@/components/forms/lesson-form"));
type Props = {
  student: TStudent;
  syllabuses: TSyllabus[];
};
export default function Syllabuses({ student, syllabuses }: Props) {
  const router = useRouter();
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLessonCreating, setIsLessonCreating] =
    React.useState<TSyllabus | null>(null);
  const [editingSyllabus, setEditingSyllabus] =
    React.useState<TSyllabus | null>(null);
  const [editingPayment, setEditingPayment] = React.useState<TSyllabus | null>(
    null,
  );
  const [editingLesson, setEditingLesson] = React.useState<TLesson | null>(
    null,
  );
  const [openBulkLesson, setOpenBulkLesson] = React.useState<TSyllabus | null>(null);
  const [openFeedback, setOpenFeedback] = React.useState<any>(null);

  const onDoneClick = React.useCallback(
    (lesson: TLesson) => {
      fetch(`/api/lessons/${lesson.id}/done`, {
        method: "PUT",
      }).then((response) => {
        router.refresh();
      });
    },
    [router],
  );

  return (
    <div className="mt-8">
      <div className="flex justify-end">
        <Button color="emerald" onClick={setIsCreating.bind(null, true)}>
          일정 추가
        </Button>
      </div>
      {Array.isArray(syllabuses) && syllabuses.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-5">
          {syllabuses.map((syllabus) => (
            <li
              key={syllabus.id}
              className="mx-3 px-5 py-3 border dark:border-white/10 rounded-lg shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{syllabus.title}</p>
                </div>
                <div>
                  <Dropdown>
                    <DropdownButton plain>
                      <EllipsisVerticalIcon />
                    </DropdownButton>
                    <DropdownMenu>
                      <DropdownItem
                        onClick={setEditingSyllabus.bind(null, syllabus)}
                      >
                        수정
                      </DropdownItem>
                      <DropdownDivider />
                      <DropdownSection>
                        <DropdownHeading>수업</DropdownHeading>
                        <DropdownItem
                          onClick={setIsLessonCreating.bind(null, syllabus)}
                        >
                          <DropdownLabel>수업 추가</DropdownLabel>
                        </DropdownItem>
                      </DropdownSection>
                      <DropdownDivider />
                      <DropdownSection>
                        <DropdownHeading>입금내역</DropdownHeading>
                        <DropdownItem
                          onClick={setEditingPayment.bind(null, syllabus)}
                        >
                          입금 내역 수정
                        </DropdownItem>
                      </DropdownSection>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
              <Text className="whitespace-pre-wrap">{syllabus.notes}</Text>
              <Divider className="my-3" />
              {syllabus.lessons.length > 0 ? (
                <ul>
                  {syllabus.lessons.map((lesson) => (
                    <li
                      key={`lesson-${lesson.id}`}
                      className="py-2 flex items-center"
                    >
                      {lesson.isDone ? (
                        <Button plain onClick={onDoneClick.bind(null, lesson)}>
                          <CircleCheckBigIcon
                            width={20}
                            height={20}
                            className="text-green-600"
                          />
                        </Button>
                      ) : (
                        <Button plain onClick={onDoneClick.bind(null, lesson)}>
                          <CircleIcon
                            width={20}
                            height={20}
                            className="text-amber-500"
                          />
                        </Button>
                      )}
                      <div className="grow flex items-center justify-between">
                        <div>
                          <p>{format(lesson.lessonAt, "yyyy-MM-dd HH:mm")}</p>
                          <Text className="whitespace-pre-wrap">
                            {lesson.notes}
                          </Text>
                          {lesson.feedback && (
                            <Text>피드백: {lesson.feedback.notes}</Text>
                          )}
                        </div>
                        <div className="flex gap-3">
                          {lesson.isDone && (
                            <Button
                              color="light"
                              onClick={setOpenFeedback.bind(null, lesson)}
                            >
                              피드백
                            </Button>
                          )}
                          <div>
                            <Button
                              plain
                              onClick={setEditingLesson.bind(null, lesson)}
                            >
                              수정
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-5 flex flex-col gap-3 items-center justify-center">
                    <p>설정된 레슨이 없습니다</p>
                    <Button onClick={setOpenBulkLesson.bind(null, syllabus)}>레슨 추가</Button>
                </div>
              )}
              <Divider className="my-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">입금내역</p>
                {syllabus.payment ? (
                  <div className="flex gap-3">
                    <p>{format(syllabus.payment.paidAt, "yyyy-MM-dd")}</p>
                    {/*
                    // @ts-ignore */}
                    <p>{PAYMENT_METHODS[syllabus.payment.paymentMethod]}</p>
                    <p>{formatToKoreanNumber(syllabus.payment.amount)}원</p>
                  </div>
                ) : (
                  <p>미입금</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>일정이 없습니다.</p>
      )}
      {isCreating && (
        <SyllabusForm
          student={student}
          onSuccess={() => {
            setIsCreating(false);
            router.refresh();
          }}
          onClose={setIsCreating.bind(null, false)}
        />
      )}

      {editingSyllabus && (
        <SyllabusForm
          syllabus={editingSyllabus}
          onSuccess={() => {
            router.refresh();
            setEditingSyllabus(null);
          }}
          onClose={setEditingSyllabus.bind(null, null)}
        />
      )}

      {editingLesson && (
        <LessonForm
          lesson={editingLesson}
          onSuccess={() => {
            router.refresh();
            alert("수정되었습니다.");
            setEditingLesson(null);
          }}
          onClose={setEditingLesson.bind(null, null)}
        />
      )}

      {isLessonCreating && (
        <LessonForm
          syllabus={isLessonCreating}
          onSuccess={() => {
            router.refresh();
            alert("추가되었습니다.");
            setIsLessonCreating(null);
          }}
          onClose={setIsLessonCreating.bind(null, null)}
        />
      )}

      {editingPayment && (
        <PaymentForm
          syllabus={editingPayment}
          onSuccess={() => {
            router.refresh();
            alert("수정이 완료되었습니다.");
            setEditingPayment(null);
          }}
          onClose={setEditingPayment.bind(null, null)}
        />
      )}

      {openFeedback && (
        <FeedbackForm
          lesson={openFeedback}
          onSuccess={() => {
            router.refresh();
            alert("피드백이 수정되었습니다");
            setOpenFeedback(null);
          }}
          onClose={setOpenFeedback.bind(null, null)}
        />
      )}

      {openBulkLesson && (
          <BulkLessonDialog
              syllabus={openBulkLesson}
              onSuccess={() => {
                  router.refresh();
                  alert("레슨이 추가되었습니다.");
                  setOpenBulkLesson(null);
              }}
              onClose={setOpenBulkLesson.bind(null, null)}
          />
      )}
    </div>
  );
}
