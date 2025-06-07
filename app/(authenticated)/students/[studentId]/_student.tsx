'use client';
import { CircleCheckBigIcon, CircleIcon, PlusIcon } from 'lucide-react';
import { Button, Card, CardBody, CardFooter, CardHeader, Divider } from '@heroui/react';
import { format } from 'date-fns/format';
import { formatToKoreanNumber } from '@toss/utils';
import React from 'react';
import type { TLesson } from '@/types/index';
import { Text } from '@/components/text';
import StudentModal from '@/components/student-modal';

const PAYMENT_METHODS = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};
export default function Student({ student, syllabuses }) {
  const [isEditing, setIsEditing] = React.useState(false);

  return (
    <div>
      <header className="mb-6 flex w-full items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-default-900 lg:text-3xl">{student.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsEditing(true)}>
            수정
          </Button>
          <Button
            className="bg-foreground text-background"
            startContent={
              <PlusIcon />
            }
          >
            계획 추가
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-6">
        {syllabuses.map(syllabus => (
          <Card>
            <CardHeader>
              <div>
                <p className="text-lg font-bold">{syllabus.title}</p>
                <p className="text-sm text-gray-300">{syllabus.notes}</p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody>
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
                                <Button
                                  variant="light"
                                  // onPress={onDoneClick.bind(null, lesson)}
                                >
                                  <CircleCheckBigIcon
                                    width={20}
                                    height={20}
                                    className="text-green-600"
                                  />
                                </Button>
                              )
                            : (
                                <Button
                                  variant="light"
                                  // onPress={onDoneClick.bind(null, lesson)}
                                >
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
                                  // onClick={setOpenFeedback.bind(null, lesson)}
                                >
                                  피드백
                                </Button>
                              )}
                              <div>
                                <Button
                                  variant="light"
                                  // onPress={setEditingLesson.bind(null, lesson)}
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
                      <Button
                        // onClick={setOpenBulkLesson.bind(null, syllabus)}
                      >
                        레슨 추가
                      </Button>
                    </div>
                  )}
            </CardBody>
            <Divider />
            <CardFooter>
              {syllabus.payment
                ? (
                    <div className="flex gap-3">
                      <p>{format(syllabus.payment.paidAt, 'yyyy-MM-dd')}</p>
                      <p>{PAYMENT_METHODS[syllabus.payment.paymentMethod]}</p>
                      <p>
                        {formatToKoreanNumber(syllabus.payment.amount)}
                        원
                      </p>
                    </div>
                  )
                : (
                    <p>미입금</p>
                  )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <StudentModal
        isOpen={isEditing}
        onClose={() => { setIsEditing(false); }}
        student={student}
      />
    </div>
  );
}
