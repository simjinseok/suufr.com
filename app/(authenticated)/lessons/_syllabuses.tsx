'use client';
import type { TLesson, TStudent, TSyllabus } from '@/types/index';

import { format } from 'date-fns/format';
import { numberToHangulMixed } from 'es-hangul';

import React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import {
  CircleIcon,
  CircleCheckBigIcon,
  EllipsisVerticalIcon, UserIcon, TicketCheckIcon, ShareIcon, GlobeIcon, LockIcon, ChevronDownIcon,
} from 'lucide-react';
import {
  Button,
  Dropdown,
  Header, ListBox, Surface, Form, Chip, Tooltip, Modal, ButtonGroup,
} from '@heroui/react';

import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import FeedbackForm from '@/components/forms/feedback-form';
import BulkLessonDialog from './_bulk-lesson-dialog';
import LessonModal from '@/components/lesson-modal';
import PaymentModal from '@/components/payment-modal';
import SyllabusModal from '@/components/syllabus-modal';
import EditSyllabusModal from './_edit-syllabus-modal';
import CreateSyllabusModal from '@/components/syllabus/create-syllabus-modal';
import ShareModal from './_share-modal';
import { StudentComboBox } from '@/components/student/student-combobox';
import EditSessionModal from '@/components/sessions/edit-session-modal';
import AddSessionModal from '@/components/sessions/add-session-modal';

const PAYMENT_METHODS = {
  card: '카드',
  transfer: '계좌이체',
  cash: '현금',
  none: '미지정',
};
const LessonForm = dynamic(() => import('@/components/forms/lesson-form'));
type Props = {
  syllabuses: TSyllabus[];
};
export default function Syllabuses({ syllabuses }: any) {
  const router = useRouter();
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLessonCreating, setIsLessonCreating]
    = React.useState<TSyllabus | null>(null);
  const [editingSyllabus, setEditingSyllabus]
    = React.useState<TSyllabus | null>(null);
  const [editingPayment, setEditingPayment] = React.useState<TSyllabus | null>(
    null,
  );
  const [editingLesson, setEditingLesson] = React.useState<TLesson | null>(
    null,
  );
  const [openBulkLesson, setOpenBulkLesson] = React.useState<TSyllabus | null>(
    null,
  );
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [openFeedback, setOpenFeedback] = React.useState<any>(null);
  const [sharingSyllabus, setSharingSyllabus] = React.useState<TSyllabus | null>(null);

  return (
    <div className="mt-8">
      {Array.isArray(syllabuses) && syllabuses.length > 0
        ? (
            <ul className="mt-5 flex flex-col gap-5">
              {syllabuses.map(syllabus => (
                <li key={syllabus.id}>
                  <Surface className="px-5 py-3 border border-gray-50 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="grow">
                        <div className="flex items-center gap-1">

                          <Chip variant="secondary" color="accent">
                            <UserIcon className="size-3" />
                            {syllabus.student!.name}
                          </Chip>

                          <button
                            type="button"
                            className="cursor-pointer"
                            onClick={setEditingPayment.bind(null, syllabus)}
                          >
                            {syllabus.payment
                              ? (
                                  <Chip variant="soft" color="success">
                                    <TicketCheckIcon className="size-4" />
                                    결제완료
                                  </Chip>
                                )
                              : (
                                  <Chip variant="soft" color="danger">결제필요</Chip>
                                )}
                          </button>
                        </div>
                        <p className="mt-1 text-xl font-bold">{syllabus.title}</p>
                      </div>
                      <div className="flex gap-3">
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
                          <Button
                            onClick={setEditingSyllabus.bind(null, syllabus)}
                          >
                            수정
                          </Button>
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
                                <Dropdown.Section>
                                  <Header>입금내역</Header>
                                  <Dropdown.Item
                                    key="edit-payment"
                                    onClick={setEditingPayment.bind(null, syllabus)}
                                  >
                                    입금 내역 수정
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
                          <Button onClick={setOpenBulkLesson.bind(null, syllabus)}>
                            수업 추가
                          </Button>
                        </div>
                      )}
                    >
                      {session => (
                        <ListBox.Item
                          id={session.id}
                          textValue={session.id}
                          className="flex items-start"
                          onAction={() => {
                            setSelectedSessionId(session);
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
                            <p className="tabular-nums">{format(new Date(session.lessonAt), 'yyyy-MM-dd hh:mm')}</p>
                            <Text className="whitespace-pre-wrap">
                              {session.notes}
                            </Text>
                            {session.feedback && (
                              <Text>
                                피드백:
                                {session.feedback.notes}
                              </Text>
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
      {/* {isCreating && ( */}
      {/*  <SyllabusModal */}
      {/*    isOpen={isCreating} */}
      {/*    student={student} */}
      {/*    onClose={setIsCreating.bind(null, false)} */}
      {/*  /> */}
      {/* )} */}
      {selectedSessionId && (
        <EditSessionModal
          isOpen={selectedSessionId}
          onOpenChange={setSelectedSessionId}
          session={selectedSessionId}
        />
      )}

      {editingSyllabus && (
        <EditSyllabusModal
          isOpen={editingSyllabus !== null}
          syllabus={editingSyllabus}
          onClose={setEditingSyllabus.bind(null, null)}
        />
      )}

      {isLessonCreating && (
        <AddSessionModal
          isOpen={isLessonCreating !== null}
          onOpenChange={setIsLessonCreating.bind(null, null)}
          lesson={isLessonCreating}
        />
      )}

      {/* <LessonModal */}
      {/*  isOpen={editingLesson !== null} */}
      {/*  lesson={editingLesson} */}
      {/*  onClose={() => setEditingLesson(null)} */}
      {/* /> */}

      {/* <LessonModal */}
      {/*  isOpen={isLessonCreating !== null} */}
      {/*  syllabus={isLessonCreating} */}
      {/*  onClose={() => setIsLessonCreating(null)} */}
      {/* /> */}

      {editingPayment && (
        <PaymentModal
          isOpen={editingPayment !== null}
          syllabus={editingPayment}
          onClose={setEditingPayment.bind(null, null)}
        />
      )}

      {/* {openFeedback && ( */}
      {/*  <FeedbackForm */}
      {/*    lesson={openFeedback} */}
      {/*    onSuccess={() => { */}
      {/*      router.refresh(); */}
      {/*      alert('피드백이 수정되었습니다'); */}
      {/*      setOpenFeedback(null); */}
      {/*    }} */}
      {/*    onClose={setOpenFeedback.bind(null, null)} */}
      {/*  /> */}
      {/* )} */}

      {/* {openBulkLesson && ( */}
      {/*  <BulkLessonDialog */}
      {/*    syllabus={openBulkLesson} */}
      {/*    onSuccess={() => { */}
      {/*      router.refresh(); */}
      {/*      alert('레슨이 추가되었습니다.'); */}
      {/*      setOpenBulkLesson(null); */}
      {/*    }} */}
      {/*    onClose={setOpenBulkLesson.bind(null, null)} */}
      {/*  /> */}
      {/* )} */}
    </div>
  );
}
