'use client';

import Link from 'next/link';
import { Chip, Surface } from '@heroui/react';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';
import { tz } from '@date-fns/tz';

import { useTimeZone } from '@/contexts/timezone';

type SessionItem = {
  uuid: string;
  sessionAt: string;
  duration: number;
  notes: string;
  isDone: boolean;
  invoiceTitle: string | null;
  student: {
    uuid: string;
    name: string;
  };
};

type Props = {
  sessions: SessionItem[];
  use24HourFormat: boolean;
};

export default function SessionsList({ sessions, use24HourFormat }: Props) {
  const timeZone = useTimeZone();

  if (sessions.length === 0) {
    return <p className="mt-8 text-center text-gray-500">세션이 없습니다.</p>;
  }

  return (
    <Surface className="mt-5 rounded-xl shadow-xs overflow-hidden">
      <ul>
        {sessions.map((session, index) => {
          const sessionAt = new Date(session.sessionAt);

          return (
            <li
              key={session.uuid}
              className={`px-5 py-3 ${index > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      {format(sessionAt, 'yyyy년 M월 d일', { locale: ko, in: tz(timeZone) })}
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
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/students/${session.student.uuid}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      {session.student.name}
                    </Link>
                    {session.invoiceTitle && (
                      <span className="text-xs text-gray-400">{session.invoiceTitle}</span>
                    )}
                  </div>
                  {session.notes && (
                    <p className="mt-1 text-sm text-gray-500 truncate">{session.notes}</p>
                  )}
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
              </div>
            </li>
          );
        })}
      </ul>
    </Surface>
  );
}
