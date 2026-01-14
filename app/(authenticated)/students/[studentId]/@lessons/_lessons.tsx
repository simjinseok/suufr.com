'use client';
import type { TSyllabus } from '@/types/index';

import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import { tz } from '@date-fns/tz';

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
import EditSyllabusModal from '@/components/lesson/edit-lesson-modal';
import AddSessionModal from '@/components/sessions/add-session-modal';
import PaymentModal from '@/components/lesson/payment-modal';
import ShareModal from '@/components/lesson/share-modal';
import CreateLessonModal from '@/components/lesson/create-lesson-modal';
import { useParams } from 'next/navigation';

export default function Lessons({ lessons }) {
  const { studentId } = useParams();

  const [selectedSession, setSelectedSession] = React.useState<string | null>(null);
  const [isLessonCreating, setIsLessonCreating]
    = React.useState<TSyllabus | null>(null);

  return (
    <React.Fragment>
      <div className="flex justify-end">
        <Modal>
          <Button variant="secondary">
            <PlusIcon />
            레슨 추가
          </Button>
          <CreateLessonModal
            studentId={Number(studentId)}
          />
        </Modal>
      </div>
      {lessons.length > 0
        ? (
            <ul className="mt-5 flex flex-col gap-5">
              {lessons.map(syllabus => (
                <li key={syllabus.id}>
                  <Surface className="px-5 py-3 border border-gray-50 rounded-xl shadow-sm">
                    {/* 모바일: 칩 + 버튼 / 제목 세로 배치 */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Modal>
                            <Modal.Trigger>
                              {syllabus.payment
                                ? (
                                    <Chip size="sm" variant="soft">
                                      {syllabus.payment.paymentMethod === 'card' && <CreditCardIcon className="size-3" />}
                                      {syllabus.payment.paymentMethod === 'transfer' && <LandmarkIcon className="size-3" />}
                                      {syllabus.payment.paymentMethod === 'cash' && <BanknoteIcon className="size-3" />}
                                      {syllabus.payment.paymentMethod === 'none' && <BookDashedIcon className="size-3" />}
                                      {numberToHangulMixed(syllabus.payment.amount)}
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
                            <PaymentModal syllabus={syllabus} />
                          </Modal>
                          <Modal>
                            <Modal.Trigger>
                              <Chip size="sm" variant={syllabus.shares?.length ? 'soft' : 'secondary'} color="accent">
                                {syllabus.shares?.length ? <GlobeIcon className="size-3" /> : <LockIcon className="size-3" />}
                                {syllabus.shares?.length ? '공유중' : '공유'}
                              </Chip>
                            </Modal.Trigger>
                            <ShareModal syllabus={syllabus} />
                          </Modal>
                        </div>
                        <ButtonGroup variant="secondary" size="sm">
                          <Modal>
                            <Button>수정</Button>
                            <EditSyllabusModal lesson={syllabus} />
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
                                    key="create-syllabus"
                                    onClick={setIsLessonCreating.bind(null, syllabus)}
                                  >
                                    수업 추가
                                  </Dropdown.Item>
                                </Dropdown.Section>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        </ButtonGroup>
                      </div>
                      <p className="text-xl font-bold">{syllabus.title}</p>
                    </div>

                    {/* PC: 기존 가로 배치 */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="grow">
                        <p className="mt-1 text-xl font-bold">{syllabus.title}</p>
                      </div>
                      <div className="flex gap-3">
                        <Modal>
                          {syllabus.payment
                            ? (
                                <Button variant="secondary">
                                  {syllabus.payment.paymentMethod === 'card' && (
                                    <CreditCardIcon className="size-4" />
                                  )}
                                  {syllabus.payment.paymentMethod === 'transfer' && (
                                    <LandmarkIcon className="size-4" />
                                  )}
                                  {syllabus.payment.paymentMethod === 'cash' && (
                                    <BanknoteIcon className="size-4" />
                                  )}
                                  {syllabus.payment.paymentMethod === 'none' && (
                                    <BookDashedIcon className="size-4" />
                                  )}
                                  {numberToHangulMixed(syllabus.payment.amount)}
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
                            syllabus={syllabus}
                          />
                        </Modal>
                        <Modal>
                          <Button
                            variant="primary"
                          >
                            {syllabus.shares?.length ? <GlobeIcon className="size-4" /> : <LockIcon className="size-4" />}
                            {syllabus.shares?.length ? '공유중' : '공유'}
                          </Button>
                          <ShareModal
                            syllabus={syllabus}
                          />
                        </Modal>
                        <ButtonGroup variant="secondary">
                          <Modal>
                            <Button>
                              수정
                            </Button>
                            <EditSyllabusModal
                              lesson={syllabus}
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
                                    key="create-syllabus"
                                    onClick={setIsLessonCreating.bind(null, syllabus)}
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
                    <Text className="mt-1 whitespace-pre-wrap">{syllabus.notes}</Text>
                    <Divider className="my-3" />
                    <ListBox
                      aria-label={`계획 ${syllabus.id}의 수업 목록`}
                      selectionMode="none"
                      items={syllabus.lessons}
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
                            <p className="tabular-nums">{format(new Date(session.lessonAt), 'yyyy-MM-dd hh:mm', { in: tz('Asia/Seoul') })}</p>
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
