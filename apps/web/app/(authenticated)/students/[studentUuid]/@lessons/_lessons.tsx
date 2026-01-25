'use client';
import type { TLesson } from '@/types/index';

import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import { tz } from '@date-fns/tz';
import { formatTime } from '@/utils/time-format';

import { Button, ButtonGroup, Chip, Dropdown, Header, ListBox, Modal, Surface } from '@heroui/react';
import {
  BanknoteIcon,
  BanknoteXIcon, BookDashedIcon,
  ChevronDownIcon,
  CircleCheckBigIcon,
  CircleIcon, Clock4Icon, CreditCardIcon,
  GlobeIcon, LandmarkIcon,
  LockIcon, PlusIcon,
} from 'lucide-react';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import React from 'react';
import { modal } from '@/contexts/modal-manager';
import EditSessionModal from '@/components/sessions/edit-session-modal';
import EditLessonModal from '@/components/lesson/edit-lesson-modal';
import CreateSessionModal from '@/components/sessions/create-session-modal';
import PaymentModal from '@/components/lesson/payment-modal';
import ShareModal from '@/components/lesson/share-modal';
import CreateLessonModal from '@/components/lesson/create-lesson-modal';
import { useParams } from 'next/navigation';
import { ko } from 'date-fns/locale';

export default function Lessons({ lessons, use24HourFormat }: { lessons: any[]; use24HourFormat: boolean }) {
  const { studentUuid } = useParams<{ studentUuid: string }>();

  const [selectedSession, setSelectedSession] = React.useState<string | null>(null);
  const [isLessonCreating, setIsLessonCreating]
    = React.useState<TLesson | null>(null);

  return (
    <React.Fragment>
      <div className="flex justify-end">
        <Modal>
          <Button variant="secondary" size="sm">
            <PlusIcon className="size-4" />
            레슨 추가
          </Button>
          <CreateLessonModal
            studentUuid={studentUuid}
          />
        </Modal>
      </div>
      {lessons.length > 0
        ? (
            <ul className="mt-5 flex flex-col gap-5">
              {lessons.map(lesson => (
                <li key={lesson.id} className="rounded-xl shadow-sm overflow-hidden">
                  {!lesson.payment && (
                    <div className="text-center font-medium text-white bg-danger">
                      결제필요
                    </div>
                  )}
                  <Surface className="px-3 py-3 border-x border-gray-50 rounded-none shadow-none">
                    {/* 모바일: 칩 + 버튼 / 제목 세로 배치 */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      <div className="flex items-center justify-between">
                      </div>
                      <div className="flex justify-between">
                        <p className="text-xl font-bold">{lesson.title}</p>
                        <ButtonGroup variant="secondary">
                          <Button
                            variant="secondary"
                            onPress={() => modal.show(EditLessonModal, { lesson })}
                          >
                            수정
                          </Button>
                          <Dropdown>
                            <Button variant="secondary">
                              <ChevronDownIcon />
                            </Button>
                            <Dropdown.Popover placement="bottom end" className="min-w-40">
                              <Dropdown.Menu>
                                <Dropdown.Section>
                                  <Header>수업</Header>
                                  <Dropdown.Item
                                    key="create-session"
                                    onClick={setIsLessonCreating.bind(null, lesson)}
                                  >
                                    수업 추가
                                  </Dropdown.Item>
                                </Dropdown.Section>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        </ButtonGroup>

                      </div>
                    </div>

                    {/* PC: 기존 가로 배치 */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="grow">
                        <p className="mt-1 text-xl font-bold">{lesson.title}</p>
                      </div>
                      <div className="flex gap-3">

                        <ButtonGroup size="sm" variant="secondary">
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => modal.show(EditLessonModal, { lesson })}
                          >
                            수정
                          </Button>
                          <Dropdown>
                            <Button size="sm" variant="secondary">
                              <ChevronDownIcon />
                            </Button>
                            <Dropdown.Popover placement="bottom end" className="min-w-40">
                              <Dropdown.Menu>
                                <Dropdown.Section>
                                  <Header>수업</Header>
                                  <Dropdown.Item
                                    key="create-session"
                                    onClick={setIsLessonCreating.bind(null, lesson)}
                                  >
                                    수업 추가
                                  </Dropdown.Item>
                                </Dropdown.Section>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        </ButtonGroup>
                      </div>
                    </div>
                    <Text className="mt-1 text-sm whitespace-pre-wrap">{lesson.notes}</Text>
                    <Divider className="my-3" />
                    <ListBox
                      aria-label={`레슨 ${lesson.id}의 수업 목록`}
                      selectionMode="none"
                      items={lesson.sessions}
                      className="px-2 gap-2"
                      renderEmptyState={() => (
                        <div className="py-5 flex flex-col gap-3 items-center justify-center">
                          <p>설정된 수업이 없습니다</p>
                        </div>
                      )}
                    >
                      {session => (
                        <ListBox.Item
                          id={session.id}
                          textValue={session.id}
                          className="p-0 flex items-start"
                          onAction={() => {
                            setSelectedSession(session);
                          }}
                        >
                          <div className="size-6 flex items-center justify-center">
                            {session.isDone
                              ? (
                                  <CircleCheckBigIcon
                                    width={20}
                                    height={20}
                                    className="text-green-600"
                                  />
                                )
                              : (
                                  <CircleIcon
                                    width={20}
                                    height={20}
                                    className="text-amber-500"
                                  />
                                )}
                          </div>
                          <div className="w-full">
                            <div className="flex justify-between">
                              <p className="">
                                <span className="tabular-nums text-lg font-bold">{format(new Date(session.sessionAt), 'MM.dd', { in: tz('Asia/Seoul') })}</span>
                                <span className="ml-1 text-sm text-gray-600">{format(new Date(session.sessionAt), 'cccc', { locale: ko, in: tz('Asia/Seoul') })}</span>
                              </p>
                              <div className="flex items-center gap-1 text-sm text-gray-600 tabular-nums">
                                <Clock4Icon className="inline-block size-3.5" />
                                <p className="">
                                  {formatTime(session.sessionAt, use24HourFormat)}
                                </p>
                                <Chip size="sm">
                                  {session.duration}
                                  분
                                </Chip>
                              </div>
                            </div>
                            {session.notes && (
                              <Text className="p-2 bg-default/30 rounded whitespace-pre-wrap">
                                {session.notes}
                              </Text>
                            )}
                            {session.feedback && (
                              <div className="mt-1 p-2 bg-accent-soft-hover border border-accent/50 rounded-xl">
                                <p className="text-sm text-accent font-bold">피드백</p>
                                <Text className="text-sm whitespace-pre-wrap">
                                  {session.feedback.notes}
                                </Text>
                              </div>
                            )}
                          </div>
                        </ListBox.Item>
                      )}

                    </ListBox>
                  </Surface>
                  <div className="px-3 py-2 flex justify-between bg-white">
                    {lesson.payment
                      ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => modal.show(PaymentModal, { lesson })}
                          >
                            {lesson.payment.paymentMethod === 'card' && (
                              <CreditCardIcon className="size-4" />
                            )}
                            {lesson.payment.paymentMethod === 'transfer' && (
                              <LandmarkIcon className="size-4" />
                            )}
                            {lesson.payment.paymentMethod === 'cash' && (
                              <BanknoteIcon className="size-4" />
                            )}
                            {lesson.payment.paymentMethod === 'none' && (
                              <BookDashedIcon className="size-4" />
                            )}
                            {numberToHangulMixed(lesson.payment.amount)}
                            원
                          </Button>
                        )
                      : (
                          <Button
                            variant="danger-soft"
                            size="sm"
                            onPress={() => modal.show(PaymentModal, { lesson })}
                          >
                            <BanknoteXIcon className="size-4" />
                            결제필요
                          </Button>
                        )}
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => modal.show(ShareModal, { lesson })}
                    >
                      {lesson.shares?.length ? <GlobeIcon className="size-4" /> : <LockIcon className="size-4" />}
                      {lesson.shares?.length ? '공유중' : '공유'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )
        : (
            <p>일정이 없습니다.</p>
          )}
      {selectedSession && (
        <EditSessionModal
          isOpen={selectedSession}
          onOpenChange={setSelectedSession}
          session={selectedSession}
        />
      )}

      {isLessonCreating && (
        <CreateSessionModal
          isOpen={isLessonCreating !== null}
          onOpenChange={setIsLessonCreating.bind(null, null)}
          lesson={isLessonCreating}
        />
      )}
    </React.Fragment>
  );
}
