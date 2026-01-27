'use client';
import type { TLesson, TSession } from '@/types/index';

import { numberToHangulMixed } from 'es-hangul';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';

import { Button, ButtonGroup, Dropdown, Header, Modal, Surface } from '@heroui/react';
import {
  AlertTriangleIcon,
  BanknoteIcon,
  BookDashedIcon,
  ChevronDownIcon,
  CreditCardIcon,
  FileIcon,
  GlobeIcon,
  ImageIcon,
  LandmarkIcon,
  LockIcon,
  PlusIcon,
  VideoIcon,
} from 'lucide-react';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import React from 'react';
import EditSessionModal from '@/components/sessions/edit-session-modal';
import EditFeedbackModal from '@/components/sessions/edit-feedback-modal';
import EditLessonModal from '@/components/lesson/edit-lesson-modal';
import CreateSessionModal from '@/components/sessions/create-session-modal';
import PaymentModal from '@/components/lesson/payment-modal';
import ShareModal from '@/components/lesson/share-modal';
import CreateLessonModal from '@/components/lesson/create-lesson-modal';
import { useParams, useRouter } from 'next/navigation';
import { toggleSessionDone } from '@/actions/session';

function AnimatedCheckIcon({
  checked,
  animating,
}: {
  checked: boolean;
  animating: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-5 transition-transform duration-150 active:scale-85 ${
        animating && checked ? 'animate-bounce-check' : ''
      }`}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        className={`transition-all duration-200 ${
          checked ? 'fill-green-600' : 'fill-transparent'
        }`}
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        className={`fill-none stroke-2 transition-all duration-200 ${
          checked ? 'stroke-green-600' : 'stroke-amber-500'
        }`}
      />
      <path
        d="M7 12.5l3 3 7-7"
        className="fill-none stroke-white stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]"
        style={{
          strokeDasharray: 20,
          strokeDashoffset: checked ? 0 : 20,
          transition: 'stroke-dashoffset 0.25s cubic-bezier(0.65, 0, 0.35, 1) 0.1s',
        }}
      />
    </svg>
  );
}

// 파일 타입에 따른 아이콘 반환
function FileTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'image':
      return <ImageIcon className={className} />;
    case 'video':
      return <VideoIcon className={className} />;
    default:
      return <FileIcon className={className} />;
  }
}

export default function Lessons({ lessons, use24HourFormat }: { lessons: any[]; use24HourFormat: boolean }) {
  const { studentUuid } = useParams<{ studentUuid: string }>();
  const router = useRouter();

  const [selectedSession, setSelectedSession] = React.useState<TSession | null>(null);
  const [isLessonCreating, setIsLessonCreating] = React.useState<TLesson | null>(null);
  const [feedbackSession, setFeedbackSession] = React.useState<TSession | null>(null);

  // 체크 토글 애니메이션 상태
  const [togglingSessionUuid, setTogglingSessionUuid] = React.useState<string | null>(null);
  const [optimisticDone, setOptimisticDone] = React.useState<Record<string, boolean>>({});

  const handleToggleDone = async (session: TSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIsDone = !(optimisticDone[session.uuid] ?? session.isDone);

    // 낙관적 업데이트 + 애니메이션 트리거
    setOptimisticDone(prev => ({ ...prev, [session.uuid]: newIsDone }));
    setTogglingSessionUuid(session.uuid);

    await toggleSessionDone(session.uuid, newIsDone);
    router.refresh();

    // 애니메이션 완료 후 상태 정리
    setTimeout(() => setTogglingSessionUuid(null), 400);
  };

  // 실제 표시할 isDone 값 (낙관적 업데이트 우선)
  const getIsDone = (session: TSession) => optimisticDone[session.uuid] ?? session.isDone;

  return (
    <React.Fragment>
      <div className="flex justify-end">
        <Modal>
          <Button variant="secondary" size="sm">
            <PlusIcon className="size-4" />
            레슨 추가
          </Button>
          <CreateLessonModal studentUuid={studentUuid} />
        </Modal>
      </div>

      {lessons.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-5">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Surface
                className={`rounded-xl shadow-xs overflow-hidden ${
                  !lesson.payment ? 'border-red-200' : 'border-gray-50'
                }`}
              >
                {/* 결제필요 배너 (카드 상단) */}
                {!lesson.payment && (
                  <div className="px-5 py-2 bg-red-50 border-b border-red-100 flex items-center gap-1.5">
                    <AlertTriangleIcon className="size-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-600">결제필요</span>
                  </div>
                )}

                {/* 카드 본문 */}
                <div className="px-5 py-3">
                  {/* 헤더: 제목 + 수정 버튼 */}
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold">{lesson.title}</p>
                    <ButtonGroup variant="secondary" size="sm">
                      <Modal>
                        <Button>수정</Button>
                        <EditLessonModal lesson={lesson} />
                      </Modal>
                      <Dropdown>
                        <Button>
                          <ChevronDownIcon className="size-4" />
                        </Button>
                        <Dropdown.Popover placement="bottom end" className="min-w-40">
                          <Dropdown.Menu>
                            <Dropdown.Section>
                              <Header>수업</Header>
                              <Dropdown.Item
                                key="create-session"
                                onClick={() => setIsLessonCreating(lesson)}
                              >
                                수업 추가
                              </Dropdown.Item>
                            </Dropdown.Section>
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </ButtonGroup>
                  </div>

                  {lesson.notes && (
                    <Text className="mt-1 whitespace-pre-wrap">{lesson.notes}</Text>
                  )}

                  <Divider className="my-3" />

                  {/* 세션 목록 */}
                  {lesson.sessions.length > 0 ? (
                    <ul>
                      {lesson.sessions.map((session: any, index: number) => (
                        <li
                          key={session.id}
                          className={index > 0 ? 'border-t border-gray-50 pt-2 mt-2' : ''}
                        >
                          <div className="flex items-start gap-3">
                            {/* 완료/미완료 아이콘 (클릭으로 토글) */}
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 cursor-pointer"
                              onClick={(e) => handleToggleDone(session, e)}
                            >
                              <AnimatedCheckIcon
                                checked={getIsDone(session)}
                                animating={togglingSessionUuid === session.uuid}
                              />
                            </button>

                            <div className="flex-1 min-w-0">
                              {/* 세션 클릭 영역 */}
                              <div
                                className="cursor-pointer"
                                onClick={() => setSelectedSession(session)}
                              >
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <p className="font-semibold text-gray-900">
                                    {format(new Date(session.sessionAt), 'M월 d일', { locale: ko })}
                                  </p>
                                  <span className="text-sm text-gray-500">
                                    (
                                    {format(new Date(session.sessionAt), 'E', { locale: ko })}
                                    )
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {format(new Date(session.sessionAt), use24HourFormat ? 'HH:mm' : 'a h:mm', { locale: ko })}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    ·
                                    {session.duration}
                                    분
                                  </span>
                                </div>
                                {session.notes && (
                                  <Text className="mt-1 whitespace-pre-wrap text-sm">
                                    {session.notes}
                                  </Text>
                                )}

                                {/* 세션 첨부파일 */}
                                {session.sessionMediaFiles?.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {session.sessionMediaFiles.map((file: any) => (
                                      <a
                                        key={file.mediaFile.uuid}
                                        href={file.mediaFile.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600 hover:bg-gray-200"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <FileTypeIcon
                                          type={file.mediaFile.type}
                                          className="size-3 text-gray-500"
                                        />
                                        {file.mediaFile.fileName || '파일'}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 피드백 영역 */}
                              {getIsDone(session) && (
                                <>
                                  {session.feedback ? (
                                    <div
                                      className="mt-2.5 p-2.5 bg-gray-50 rounded-lg cursor-pointer"
                                      onClick={() => setFeedbackSession(session)}
                                    >
                                      <p className="text-xs font-semibold text-indigo-600 mb-1">
                                        피드백
                                      </p>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {session.feedback.notes}
                                      </p>
                                      {/* 피드백 첨부파일 */}
                                      {session.feedback.feedbackMediaFiles?.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                          {session.feedback.feedbackMediaFiles.map((file: any) => (
                                            <a
                                              key={file.mediaFile.uuid}
                                              href={file.mediaFile.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 rounded text-xs text-indigo-700 hover:bg-indigo-100"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <FileTypeIcon
                                                type={file.mediaFile.type}
                                                className="size-3"
                                              />
                                              {file.mediaFile.fileName || '파일'}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      className="mt-2.5 p-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-lg cursor-pointer flex items-center justify-center gap-1"
                                      onClick={() => setFeedbackSession(session)}
                                    >
                                      <PlusIcon className="size-3.5 text-gray-400" />
                                      <span className="text-xs text-gray-400">피드백 추가</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-5 flex flex-col gap-3 items-center justify-center">
                      <p className="text-gray-500">설정된 수업이 없습니다</p>
                    </div>
                  )}

                  {/* 수업 추가 버튼 */}
                  <button
                    className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-500 hover:text-gray-700 font-medium transition flex items-center justify-center gap-1.5"
                    onClick={() => setIsLessonCreating(lesson)}
                  >
                    <PlusIcon className="size-4" />
                    수업 추가
                  </button>
                </div>

                {/* 하단 섹션: 공유/결제 버튼 */}
                <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                  <Modal>
                    <Button variant="secondary" size="sm">
                      {lesson.shares?.length
                        ? (
                            <GlobeIcon className="size-3.5" />
                          )
                        : (
                            <LockIcon className="size-3.5" />
                          )}
                      {lesson.shares?.length ? '공유중' : '공유'}
                    </Button>
                    <ShareModal lesson={lesson} />
                  </Modal>
                  <Modal>
                    <Button variant="secondary" size="sm">
                      {lesson.payment
                        ? (
                            <>
                              {lesson.payment.paymentMethod === 'card' && (
                                <CreditCardIcon className="size-3.5" />
                              )}
                              {lesson.payment.paymentMethod === 'transfer' && (
                                <LandmarkIcon className="size-3.5" />
                              )}
                              {lesson.payment.paymentMethod === 'cash' && (
                                <BanknoteIcon className="size-3.5" />
                              )}
                              {lesson.payment.paymentMethod === 'none' && (
                                <BookDashedIcon className="size-3.5" />
                              )}
                              {numberToHangulMixed(lesson.payment.amount)}
                              원
                            </>
                          )
                        : (
                            '결제등록'
                          )}
                    </Button>
                    <PaymentModal lesson={lesson} />
                  </Modal>
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-gray-500">일정이 없습니다.</p>
      )}

      {selectedSession && (
        <EditSessionModal
          isOpen={!!selectedSession}
          onOpenChange={() => setSelectedSession(null)}
          session={selectedSession}
        />
      )}

      {isLessonCreating && (
        <CreateSessionModal
          isOpen={isLessonCreating !== null}
          onOpenChange={() => setIsLessonCreating(null)}
          lesson={isLessonCreating}
        />
      )}

      {feedbackSession && (
        <EditFeedbackModal
          isOpen={!!feedbackSession}
          onOpenChange={() => setFeedbackSession(null)}
          session={feedbackSession}
        />
      )}
    </React.Fragment>
  );
}
