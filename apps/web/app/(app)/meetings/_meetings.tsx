'use client';
import { format } from 'date-fns/format';

import React from 'react';
import { Button, Modal } from '@heroui/react';
import { CheckCircle2Icon, CircleDashedIcon } from 'lucide-react';
import EditMeetingModal from '@/components/meeting/edit-meeting-modal';
import type { TMeeting } from '@/types/index';

export default function Meetings({ meetings }: { meetings: TMeeting[] }) {
  if (meetings.length === 0) {
    return (
      <div className="mt-5 py-12 text-center text-zinc-500">
        상담 일정이 없어요
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2">
      {meetings.map(meeting => (
        <div
          key={meeting.uuid}
          className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-xs"
        >
          {meeting.isDone
            ? <CheckCircle2Icon className="size-7 text-success shrink-0" />
            : <CircleDashedIcon className="size-7 text-warning shrink-0" />}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{meeting.name}</span>
              {meeting.phone && (
                <span className="text-sm text-zinc-400 truncate">{meeting.phone}</span>
              )}
            </div>
            <div className="text-sm text-zinc-500">
              {format(meeting.meetingAt, 'M월 d일')}
              {meeting.notes && (
                <span className="ml-2 text-zinc-400">· {meeting.notes}</span>
              )}
            </div>
          </div>

          <Modal>
            <Button size="sm" variant="secondary">수정</Button>
            <EditMeetingModal meeting={meeting} />
          </Modal>
        </div>
      ))}
    </div>
  );
}
