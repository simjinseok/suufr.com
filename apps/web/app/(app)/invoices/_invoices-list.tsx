'use client';

import * as React from 'react';
import { Checkbox, Chip, Label, Modal, Surface } from '@heroui/react';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';
import { numberToHangulMixed } from 'es-hangul';

import { StudentFilter } from '@/components/student/student-filter';
import { useTimeZone } from '@/contexts/timezone';

type SessionItem = {
  uuid: string;
  sessionAt: string;
  duration: number;
  isDone: boolean;
};

type InvoiceItem = {
  uuid: string;
  title: string | null;
  price: number;
  totalCount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  sessions: SessionItem[];
  student: {
    uuid: string;
    name: string;
  };
};

type Props = {
  invoices: InvoiceItem[];
  selectedStudent: { uuid: string; name: string } | null;
  use24HourFormat: boolean;
};

// 달력 날짜(@db.Date) — 타임존 변환 없이 UTC 고정으로 표기
function formatCalendarDate(value: string) {
  return format(new Date(value), 'yyyy년 M월 d일', { locale: ko, in: tz('UTC') });
}

export default function InvoicesList({ invoices, selectedStudent, use24HourFormat }: Props) {
  const [sessionsInvoice, setSessionsInvoice] = React.useState<InvoiceItem | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <React.Fragment>
      <div className="mt-5 flex items-center justify-between gap-3">
        <StudentFilter selected={selectedStudent} />
        <Checkbox
          isSelected={isExpanded}
          onChange={setIsExpanded}
          variant="secondary"
        >
          <Checkbox.Content>
            <Checkbox.Control className="size-5">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label>수업 펼치기</Label>
          </Checkbox.Content>
        </Checkbox>
      </div>

      {invoices.length === 0
        ? (
            <p className="mt-8 text-center text-gray-500">수강권이 없습니다.</p>
          )
        : (
            <Surface className="mt-5 rounded-xl shadow-xs overflow-hidden">
              <ul>
                {invoices.map((invoice, index) => (
                  <li
                    key={invoice.uuid}
                    className={`px-5 py-3 ${index > 0 ? 'border-t border-gray-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          {invoice.periodStart && (
                            <p className="font-semibold text-gray-900">
                              {formatCalendarDate(invoice.periodStart)}
                              {invoice.periodEnd && ` ~ ${formatCalendarDate(invoice.periodEnd)}`}
                            </p>
                          )}
                          {invoice.totalCount != null && invoice.totalCount > 0 && (
                            <span className="text-sm text-gray-500">
                              {invoice.totalCount}
                              회권
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 truncate">
                          {invoice.student.name}
                          {' '}
                          ·
                          {' '}
                          {invoice.title || '수강권'}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <Chip
                          size="sm"
                          variant="soft"
                          color="accent"
                          onClick={() => setSessionsInvoice(invoice)}
                        >
                          세션
                          {' '}
                          {invoice.sessions.length}
                        </Chip>
                        {invoice.price === 0
                          ? (
                              <Chip size="sm" color="warning" variant="soft">금액 미입력</Chip>
                            )
                          : (
                              <p className="text-base font-bold text-gray-900 tabular-nums">
                                {numberToHangulMixed(invoice.price)}
                                원
                              </p>
                            )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pl-3 border-l-2 border-gray-100">
                        <SessionRows sessions={invoice.sessions} use24HourFormat={use24HourFormat} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Surface>
          )}

      {sessionsInvoice && (
        <InvoiceSessionsModal
          invoice={sessionsInvoice}
          use24HourFormat={use24HourFormat}
          onClose={() => setSessionsInvoice(null)}
        />
      )}
    </React.Fragment>
  );
}

function SessionRows({ sessions, use24HourFormat }: {
  sessions: SessionItem[];
  use24HourFormat: boolean;
}) {
  const timeZone = useTimeZone();

  if (sessions.length === 0) {
    return <p className="py-2 text-sm text-gray-400">수업이 없습니다.</p>;
  }

  return (
    <ul>
      {sessions.map((session, index) => {
        const sessionAt = new Date(session.sessionAt);

        return (
          <li
            key={session.uuid}
            className={`flex items-center justify-between gap-3 py-2 ${index > 0 ? 'border-t border-gray-50' : ''}`}
          >
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <p className="font-semibold text-gray-900">
                {format(sessionAt, 'M월 d일', { locale: ko, in: tz(timeZone) })}
              </p>
              <span className="text-sm text-gray-500">
                (
                {format(sessionAt, 'E', { locale: ko, in: tz(timeZone) })}
                )
              </span>
              <span className="text-sm text-gray-600">
                {format(sessionAt, use24HourFormat ? 'HH:mm' : 'a h:mm', { locale: ko, in: tz(timeZone) })}
              </span>
              <span className="text-xs text-gray-400">
                ·
                {session.duration}
                분
              </span>
            </div>
            <div className="shrink-0">
              {session.isDone
                ? (
                    <Chip size="sm" color="success" variant="soft">완료</Chip>
                  )
                : (
                    <Chip size="sm" color="warning" variant="soft">예정</Chip>
                  )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function InvoiceSessionsModal({ invoice, use24HourFormat, onClose }: {
  invoice: InvoiceItem;
  use24HourFormat: boolean;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog>
          {() => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>
                  {invoice.student.name}
                  {' '}
                  ·
                  {' '}
                  {invoice.title || '수강권'}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="p-1">
                  <SessionRows sessions={invoice.sessions} use24HourFormat={use24HourFormat} />
                </div>
              </Modal.Body>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
