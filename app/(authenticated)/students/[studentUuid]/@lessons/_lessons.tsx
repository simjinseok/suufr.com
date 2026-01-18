'use client';
import type { TLesson, TimeFormat } from '@/types/index';

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
  CircleIcon, CreditCardIcon,
  GlobeIcon, LandmarkIcon,
  LockIcon, PlusIcon,
} from 'lucide-react';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import React from 'react';
import EditSessionModal from '@/components/sessions/edit-session-modal';
import EditLessonModal from '@/components/lesson/edit-lesson-modal';
import AddSessionModal from '@/components/sessions/add-session-modal';
import PaymentModal from '@/components/lesson/payment-modal';
import ShareModal from '@/components/lesson/share-modal';
import CreateLessonModal from '@/components/lesson/create-lesson-modal';
import { useParams } from 'next/navigation';

export default function Lessons({ lessons, timeFormat }: { lessons: any[]; timeFormat: TimeFormat }) {
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
                <li key={lesson.id}>
                  <Surface className="px-5 py-3 border border-gray-50 rounded-xl shadow-sm">
                    {/* 모바일: 칩 + 버튼 / 제목 세로 배치 */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Modal>
                            <Modal.Trigger>
                              {lesson.payment
                                ? (
                                    <Chip size="sm" variant="soft">
                                      {lesson.payment.paymentMethod === 'card' && <CreditCardIcon className="size-3" />}
                                      {lesson.payment.paymentMethod === 'transfer' && <LandmarkIcon className="size-3" />}
                                      {lesson.payment.paymentMethod === 'cash' && <BanknoteIcon className="size-3" />}
                                      {lesson.payment.paymentMethod === 'none' && <BookDashedIcon className="size-3" />}
                                      {numberToHangulMixed(lesson.payment.amount)}
                                      원
                                    </Chip>
                                  )
                                : (
                                    <Chip size="sm" variant="soft" color="danger">
                                      <BanknoteXIcon className="size-3" />
                                      결제필요
                                    </Chip>
                                  )}
                            </Modal.Trigger>
                            <PaymentModal lesson={lesson} />
                          </Modal>
                          <Modal>
                            <Modal.Trigger>
                              <Chip size="sm" variant={lesson.shares?.length ? 'soft' : 'secondary'} color="accent">
                                {lesson.shares?.length ? <GlobeIcon className="size-3" /> : <LockIcon className="size-3" />}
                                {lesson.shares?.length ? '공유중' : '공유'}
                              </Chip>
                            </Modal.Trigger>
                            <ShareModal lesson={lesson} />
                          </Modal>
                        </div>
                        <ButtonGroup variant="secondary" size="sm">
                          <Modal>
                            <Button>수정</Button>
                            <EditLessonModal lesson={lesson} />
                          </Modal>
                          <Dropdown>
                            <Button>
                              <ChevronDownIcon />
                            </Button>
                            <Dropdown.Popover placement="bottom end">
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
                      <p className="text-xl font-bold">{lesson.title}</p>
                    </div>

                    {/* PC: 기존 가로 배치 */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="grow">
                        <p className="mt-1 text-xl font-bold">{lesson.title}</p>
                      </div>
                      <div className="flex gap-3">
                        <Modal>
                          {lesson.payment
                            ? (
                                <Button variant="secondary">
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
                                <Button variant="danger-soft">
                                  <BanknoteXIcon className="size-4" />
                                  결제필요
                                </Button>
                              )}
                          <PaymentModal
                            lesson={lesson}
                          />
                        </Modal>
                        <Modal>
                          <Button
                            variant="primary"
                          >
                            {lesson.shares?.length ? <GlobeIcon className="size-4" /> : <LockIcon className="size-4" />}
                            {lesson.shares?.length ? '공유중' : '공유'}
                          </Button>
                          <ShareModal
                            lesson={lesson}
                          />
                        </Modal>
                        <ButtonGroup variant="secondary">
                          <Modal>
                            <Button>
                              수정
                            </Button>
                            <EditLessonModal
                              lesson={lesson}
                            />
                          </Modal>
                          <Dropdown>
                            <Button>
                              <ChevronDownIcon />
                            </Button>
                            <Dropdown.Popover placement="bottom end">
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
                    <Text className="mt-1 whitespace-pre-wrap">{lesson.notes}</Text>
                    <Divider className="my-3" />
                    <ListBox
                      aria-label={`레슨 ${lesson.id}의 수업 목록`}
                      selectionMode="none"
                      items={lesson.sessions}
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
                          className="flex items-start"
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
                          <div>
                            <p className="tabular-nums">{format(new Date(session.sessionAt), 'yyyy-MM-dd', { in: tz('Asia/Seoul') })} {formatTime(session.sessionAt, timeFormat)}</p>
                            <Text className="whitespace-pre-wrap">
                              {session.notes}
                            </Text>
                            {session.feedback && (
                              <div className="mt-1">
                                <Text className="font-bold">피드백</Text>
                                <Text className="whitespace-pre-wrap">
                                  {session.feedback.notes}
                                </Text>
                              </div>
                            )}
                          </div>
                        </ListBox.Item>
                      )}

                    </ListBox>
                  </Surface>
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
        <AddSessionModal
          isOpen={isLessonCreating !== null}
          onOpenChange={setIsLessonCreating.bind(null, null)}
          lesson={isLessonCreating}
        />
      )}
    </React.Fragment>
  );
}
