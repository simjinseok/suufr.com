'use client';
import type { TInvoice, TSession, TStudentShare } from '@/types/index';

import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import { numberToHangulMixed } from 'es-hangul';

import { Button, Dropdown, Modal, Surface } from '@heroui/react';
import {
  AlertTriangleIcon,
  CalendarPlusIcon,
  CreditCardIcon,
  FileIcon,
  GlobeIcon,
  GlobeOffIcon,
  ImageIcon,
  EllipsisIcon,
  MoreVerticalIcon,
  PlusIcon,
  VideoIcon,
} from 'lucide-react';
import { Text } from '@/components/text';
import { Divider } from '@/components/divider';
import React from 'react';
import EditSessionModal from '@/components/sessions/edit-session-modal';
import EditFeedbackModal from '@/components/sessions/edit-feedback-modal';
import EditSessionFilesModal from '@/components/sessions/edit-session-files-modal';
import EditInvoiceModal from '@/components/invoice/edit-invoice-modal';
import CreateSessionModal from '@/components/sessions/create-session-modal';
import GenerateSessionsModal from '@/components/sessions/generate-sessions-modal';
import SettleSessionModal from '@/components/invoice/settle-session-modal';
import ShareModal from '@/components/invoice/share-modal';
import CreateInvoiceModal from '@/components/invoice/create-invoice-modal';
import { useParams, useRouter } from 'next/navigation';
import { toggleSessionDone } from '@/actions/session';
import DeleteInvoiceModal from '@/components/invoice/delete-invoice-modal';
import { useTimeZone } from '@/contexts/timezone';

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
      className={`size-5 transition-transform duration-150 ${
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

export default function Invoices({ invoices, shares, unattachedSessions, use24HourFormat }: { invoices: any[]; shares: TStudentShare[]; unattachedSessions: any[]; use24HourFormat: boolean }) {
  const timeZone = useTimeZone();
  const { studentUuid } = useParams<{ studentUuid: string }>();
  const router = useRouter();
  const [settleSessionTarget, setSettleSessionTarget] = React.useState<TSession | null>(null);

  const [selectedSession, setSelectedSession] = React.useState<TSession | null>(null);
  const [sessionCreatingInvoice, setSessionCreatingInvoice] = React.useState<TInvoice | null>(null);
  // 수강권 시작일 기준 요일·시간·횟수로 수업 일괄 생성
  const [generateInvoice, setGenerateInvoice] = React.useState<TInvoice | null>(null);
  const [isSessionCreateOpen, setIsSessionCreateOpen] = React.useState(false);
  const [feedbackSession, setFeedbackSession] = React.useState<TSession | null>(null);
  const [filesSession, setFilesSession] = React.useState<TSession | null>(null);
  const [editInvoice, setEditInvoice] = React.useState<TInvoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = React.useState<TInvoice | null>(null);
  const [isShareOpen, setIsShareOpen] = React.useState(false);

  // 체크 토글 애니메이션 상태
  const [togglingSessionUuid, setTogglingSessionUuid] = React.useState<string | null>(null);
  const [optimisticDone, setOptimisticDone] = React.useState<Record<string, boolean>>({});

  const handleToggleDone = async (session: TSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIsDone = optimisticDone[session.uuid] ?? session.isDone;
    const newIsDone = !currentIsDone;

    // 완료 해제 시 확인창
    if (currentIsDone && !newIsDone) {
      const confirmed = window.confirm('수업 완료를 해제하시겠습니까?');
      if (!confirmed) return;
    }

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
      <div className="flex justify-end gap-2">
        {/* 학생 단위 공유 */}
        <Button
          variant={shares.length ? 'primary' : 'secondary'}
          size="sm"
          onPress={() => setIsShareOpen(true)}
        >
          {shares.length ? <GlobeIcon className="size-4" /> : <GlobeOffIcon className="size-4" />}
          {shares.length ? '공유중' : '공유'}
        </Button>
        {/* 단독 수업 추가 — 청구 없이 생성 (회당 정산·보강 등), monthly/period 기간이 커버하면 서버가 자동 귀속 */}
        <Button variant="secondary" size="sm" onPress={() => setIsSessionCreateOpen(true)}>
          <PlusIcon className="size-4" />
          수업 추가
        </Button>
        <Modal>
          <Button variant="secondary" size="sm">
            <PlusIcon className="size-4" />
            수강권 추가
          </Button>
          <CreateInvoiceModal studentUuid={studentUuid} />
        </Modal>
      </div>

      {/* 정산되지 않은 수업 (invoice 미귀속) — 회당 정산 진입점이자 매출 누수 방지 */}
      {unattachedSessions.length > 0 && (
        <Surface className="mt-5 rounded-xl border-amber-200 overflow-hidden">
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
            <AlertTriangleIcon className="size-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">
              수강권 없는 수업
              {' '}
              {unattachedSessions.length}
              개
            </span>
          </div>
          <ul className="px-5 py-2">
            {unattachedSessions.map((session, index) => (
              <li
                key={session.uuid}
                className={`flex items-center justify-between gap-3 py-2 ${index > 0 ? 'border-t border-gray-50' : ''}`}
              >
                <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                  <p className="font-semibold text-gray-900">
                    {format(new Date(session.sessionAt), 'M월 d일', { locale: ko, in: tz(timeZone) })}
                  </p>
                  <span className="text-sm text-gray-500">
                    (
                    {format(new Date(session.sessionAt), 'E', { locale: ko, in: tz(timeZone) })}
                    )
                  </span>
                  <span className="text-sm text-gray-600">
                    {format(new Date(session.sessionAt), use24HourFormat ? 'HH:mm' : 'a h:mm', { locale: ko, in: tz(timeZone) })}
                  </span>
                  <span className="text-xs text-gray-400">
                    ·
                    {session.duration}
                    분
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onPress={() => setSettleSessionTarget(session)}
                >
                  <CreditCardIcon className="size-4" />
                  입금 기록
                </Button>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      {invoices.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-5">
          {invoices.map((invoice) => {
            // 납부 상태는 학생 단위 잔액으로 판정하므로 카드에는 표시하지 않는다.
            // 단 "금액 미입력"(price=0)은 잔액에 잡히지 않아 카드에서 수정을 유도한다 (§3)
            const needsPrice = invoice.price === 0;

            return (
              <li key={invoice.id}>
                <Surface
                  className={`rounded-xl shadow-xs overflow-hidden ${
                    needsPrice ? 'border-amber-200' : 'border-gray-50'
                  }`}
                >
                  {/* 금액 미입력 배너 (카드 상단) */}
                  {needsPrice && (
                    <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
                      <AlertTriangleIcon className="size-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-700">금액 미입력</span>
                    </div>
                  )}

                  {/* 카드 본문 */}
                  <div className="px-5 py-3">
                    {/* 헤더: 제목 + 수정 버튼 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <p className="text-xl font-bold truncate">{invoice.title || '수강권'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Dropdown>
                          <Button variant="secondary" size="sm" isIconOnly>
                            <EllipsisIcon className="size-4" />
                          </Button>
                          <Dropdown.Popover placement="bottom end" className="min-w-40">
                            <Dropdown.Menu>
                              <Dropdown.Item
                                key="edit-invoice"
                                onClick={() => setEditInvoice(invoice)}
                              >
                                수강권 수정
                              </Dropdown.Item>
                              {/* 횟수가 다 찬 수강권은 수업 추가 숨김 (잔여 초과 방지, 회당 정산 1회권 포함) */}
                              {!(invoice.totalCount != null && invoice.totalCount > 0 && invoice.sessions.length >= invoice.totalCount) && (
                                <Dropdown.Item
                                  key="create-session"
                                  onClick={() => setSessionCreatingInvoice(invoice)}
                                >
                                  수업 추가
                                </Dropdown.Item>
                              )}
                              <Dropdown.Item
                                key="delete-invoice"
                                className="text-red-600"
                                onClick={() => setDeleteInvoice(invoice)}
                              >
                                삭제
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      </div>
                    </div>

                    {invoice.price > 0 && (
                      <p className="mt-0.5 text-sm text-gray-500 tabular-nums">
                        {numberToHangulMixed(invoice.price)}
                        원
                      </p>
                    )}

                    {invoice.notes && (
                      <Text className="mt-1 whitespace-pre-wrap">{invoice.notes}</Text>
                    )}

                    <Divider className="my-3" />

                    {/* 세션 목록 */}
                    {invoice.sessions.length > 0 ? (
                      <ul>
                        {invoice.sessions.map((session: any, index: number) => (
                          <li
                            key={session.id}
                            className={index > 0 ? 'border-t border-gray-50 pt-2 mt-2' : ''}
                          >
                            <div className="flex items-start gap-3">
                              {/* 완료/미완료 아이콘 (클릭으로 토글) */}
                              <button
                                type="button"
                                className="mt-0.5 shrink-0 cursor-pointer active:scale-90 transition-transform"
                                onTouchStart={() => {}}
                                onClick={(e) => handleToggleDone(session, e)}
                              >
                                <AnimatedCheckIcon
                                  checked={getIsDone(session)}
                                  animating={togglingSessionUuid === session.uuid}
                                />
                              </button>

                              <div className="flex-1 min-w-0">
                                {/* 세션 내용 영역 */}
                                <div>
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <p className="font-semibold text-gray-900">
                                      {format(new Date(session.sessionAt), 'M월 d일', { locale: ko, in: tz(timeZone) })}
                                    </p>
                                    <span className="text-sm text-gray-500">
                                      (
                                      {format(new Date(session.sessionAt), 'E', { locale: ko, in: tz(timeZone) })}
                                      )
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      {format(new Date(session.sessionAt), use24HourFormat ? 'HH:mm' : 'a h:mm', { locale: ko, in: tz(timeZone) })}
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
                                </div>

                                {/* 피드백 영역 */}
                                {getIsDone(session) && session.feedback && (
                                  <div className="mt-2.5 p-2.5 bg-gray-50 rounded-lg">
                                    <p className="text-xs font-semibold text-indigo-600 mb-1">
                                      피드백
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {session.feedback.notes}
                                    </p>
                                  </div>
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

                              {/* 세션 메뉴 드롭다운 */}
                              <Dropdown>
                                <Button variant="ghost" size="sm" isIconOnly className="shrink-0 -mt-1 -mr-2">
                                  <MoreVerticalIcon className="size-4 text-gray-400" />
                                </Button>
                                <Dropdown.Popover placement="bottom end" className="min-w-36">
                                  <Dropdown.Menu>
                                    <Dropdown.Item
                                      key="edit-session"
                                      onClick={() => setSelectedSession(session)}
                                    >
                                      수업 수정
                                    </Dropdown.Item>
                                    {getIsDone(session) && (
                                      <Dropdown.Item
                                        key="edit-feedback"
                                        onClick={() => setFeedbackSession(session)}
                                      >
                                        피드백 수정
                                      </Dropdown.Item>
                                    )}
                                    <Dropdown.Item
                                      key="edit-files"
                                      onClick={() => setFilesSession(session)}
                                    >
                                      파일 첨부
                                    </Dropdown.Item>
                                  </Dropdown.Menu>
                                </Dropdown.Popover>
                              </Dropdown>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="py-5 flex flex-col gap-3 items-center justify-center">
                        <p className="text-gray-500">설정된 수업이 없습니다</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() => setGenerateInvoice(invoice)}
                        >
                          <CalendarPlusIcon className="size-4" />
                          수업 만들기
                        </Button>
                      </div>
                    )}

                  </div>

                </Surface>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 text-gray-500">일정이 없습니다.</p>
      )}

      {editInvoice && (
        <EditInvoiceModal
          isOpen={!!editInvoice}
          onOpenChange={() => setEditInvoice(null)}
          invoice={editInvoice}
        />
      )}

      {selectedSession && (
        <EditSessionModal
          isOpen={!!selectedSession}
          onOpenChange={() => setSelectedSession(null)}
          session={selectedSession}
        />
      )}

      {sessionCreatingInvoice && (
        <CreateSessionModal
          isOpen={sessionCreatingInvoice !== null}
          onOpenChange={() => setSessionCreatingInvoice(null)}
          studentUuid={studentUuid}
          invoiceUuid={sessionCreatingInvoice.uuid}
        />
      )}

      {isSessionCreateOpen && (
        <CreateSessionModal
          isOpen={isSessionCreateOpen}
          onOpenChange={() => setIsSessionCreateOpen(false)}
          studentUuid={studentUuid}
        />
      )}

      {generateInvoice && (
        <GenerateSessionsModal
          isOpen={!!generateInvoice}
          onOpenChange={() => setGenerateInvoice(null)}
          studentUuid={studentUuid}
          invoice={generateInvoice}
          use24HourFormat={use24HourFormat}
        />
      )}

      {settleSessionTarget && (
        <SettleSessionModal
          isOpen={!!settleSessionTarget}
          onOpenChange={() => setSettleSessionTarget(null)}
          studentUuid={studentUuid}
          session={settleSessionTarget}
        />
      )}

      {feedbackSession && (
        <EditFeedbackModal
          isOpen={!!feedbackSession}
          onOpenChange={() => setFeedbackSession(null)}
          session={feedbackSession}
        />
      )}

      {filesSession && (
        <EditSessionFilesModal
          isOpen={!!filesSession}
          onOpenChange={() => setFilesSession(null)}
          session={filesSession}
        />
      )}

      <ShareModal
        isOpen={isShareOpen}
        onOpenChange={() => setIsShareOpen(false)}
        studentUuid={studentUuid}
        shares={shares}
      />

      {deleteInvoice && (
        <DeleteInvoiceModal
          isOpen={!!deleteInvoice}
          onOpenChange={() => setDeleteInvoice(null)}
          invoice={deleteInvoice}
        />
      )}
    </React.Fragment>
  );
}
