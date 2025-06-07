'use client';
import type { TLesson } from '@/types/index';

import { format } from 'date-fns/format';
import { formatToKoreanNumber } from '@toss/utils';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from '@heroui/react';
import { CircleCheckBigIcon, CircleIcon, EllipsisVerticalIcon } from 'lucide-react';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';

const PAYMENT_METHODS = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};

export default function Syllabus({ studentName, syllabus }) {
  const router = useRouter();
  const [editingSyllabus, setEditingSyllabus] = React.useState(false);
  const [isLessonCreating, setIsLessonCreating] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState(false);
  const [editingLesson, setEditingLesson] = React.useState(false);
  const [openBulkLesson, setOpenBulkLesson] = React.useState(false);
  const [openFeedback, setOpenFeedback] = React.useState(false);

  const onDoneClick = React.useCallback(
    (lesson: TLesson) => {
      fetch(`/api/lessons/${lesson.id}/done`, {
        method: 'PUT',
      }).then((response) => {
        router.refresh();
      });
    },
    [router],
  );

  return (
    <React.Fragment>
      <div className="flex items-center justify-between">
        <div className="grow flex items-center gap-5">
          {studentName && (<p>{studentName}</p>)}
          <div>
            <p className="text-xl font-bold">{syllabus.title}</p>
          </div>

        </div>
        <div>
          <Dropdown>
            <DropdownTrigger>
              <Button isIconOnly variant="light">
                <EllipsisVerticalIcon />
              </Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem
                key="edit-syllabus"
                onClick={setEditingSyllabus.bind(null, syllabus)}
              >
                수정
              </DropdownItem>
              <DropdownSection title="수업">
                <DropdownItem
                  key="create-syllabus"
                  onClick={setIsLessonCreating.bind(null, syllabus)}
                >
                  수업 추가
                </DropdownItem>
              </DropdownSection>
              <DropdownSection title="입금내역">
                <DropdownItem
                  key="edit-payment"
                  onClick={setEditingPayment.bind(null, syllabus)}
                >
                  입금 내역 수정
                </DropdownItem>
              </DropdownSection>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      <Text className="mt-1 whitespace-pre-wrap">{syllabus.notes}</Text>
      <Divider className="my-3" />
      {syllabus.lessons.length > 0
        ? (
            <ul>
              {syllabus.lessons.map((lesson: TLesson) => (
                <li
                  key={`lesson-${lesson.id}`}
                  className="py-2 flex items-center"
                >
                  {lesson.isDone
                    ? (
                        <Button isIconOnly variant="light" onPress={onDoneClick.bind(null, lesson)}>
                          <CircleCheckBigIcon
                            width={20}
                            height={20}
                            className="text-green-600"
                          />
                        </Button>
                      )
                    : (
                        <Button isIconOnly variant="light" onPress={onDoneClick.bind(null, lesson)}>
                          <CircleIcon
                            width={20}
                            height={20}
                            className="text-amber-500"
                          />
                        </Button>
                      )}
                  <div className="grow flex items-center justify-between">
                    <div>
                      <p>{format(lesson.lessonAt, 'yyyy-MM-dd HH:mm')}</p>
                      <Text className="whitespace-pre-wrap">
                        {lesson.notes}
                      </Text>
                      {lesson.feedback && (
                        <Text>
                          피드백:
                          {lesson.feedback.notes}
                        </Text>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {lesson.isDone && (
                        <Button
                          color="secondary"
                          onPress={setOpenFeedback.bind(null, lesson)}
                        >
                          피드백
                        </Button>
                      )}
                      <div>
                        <Button
                          variant="light"
                          onPress={setEditingLesson.bind(null, lesson)}
                        >
                          수정
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        : (
            <div className="py-5 flex flex-col gap-3 items-center justify-center">
              <p>설정된 레슨이 없습니다</p>
              <Button onPress={setOpenBulkLesson.bind(null, syllabus)}>
                레슨 추가
              </Button>
            </div>
          )}
      <Divider className="my-3" />
      {/* 회비에 대한 언급을 하는게 부담스러울 때 있는데, 이걸 보여주면 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">입금내역</p>
        {syllabus.payment ? (
          <div className="flex gap-3">
            <p>{format(syllabus.payment.paidAt, 'yyyy-MM-dd')}</p>
            {/*
                    // @ts-ignore */}
            <p>{PAYMENT_METHODS[syllabus.payment.paymentMethod]}</p>
            <p>
              {formatToKoreanNumber(syllabus.payment.amount)}
              원
            </p>
          </div>
        ) : (
          <p>미입금</p>
        )}
      </div>
    </React.Fragment>
  );
}
