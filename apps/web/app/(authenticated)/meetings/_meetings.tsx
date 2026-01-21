'use client';
import { format } from 'date-fns/format';

import React from 'react';
import { Button, Modal } from '@heroui/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { CircleCheckBigIcon, CircleHelpIcon } from 'lucide-react';
import EditMeetingModal from '@/components/meeting/edit-meeting-modal';

export default function Meetings({ meetings }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeader>연락여부</TableHeader>
          <TableHeader>일자</TableHeader>
          <TableHeader>이름</TableHeader>
          <TableHeader>연락처</TableHeader>
          <TableHeader>노트</TableHeader>
          <TableHeader>수정</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {meetings.map(meeting => (
          <TableRow key={meeting.uuid}>
            <TableCell>
              {meeting.isDone
                ? (
                    <CircleCheckBigIcon
                      width={20}
                      height={20}
                      className="text-green-600"
                    />
                  )
                : (
                    <CircleHelpIcon
                      width={20}
                      height={20}
                      className="text-amber-500"
                    />
                  )}
            </TableCell>
            <TableCell>{format(meeting.meetingAt, 'yyyy-MM-dd')}</TableCell>
            <TableCell>{meeting.name}</TableCell>
            <TableCell>{meeting.phone}</TableCell>
            <TableCell className="whitespace-pre">{meeting.notes}</TableCell>
            <TableCell>
              <Modal>
                <Button variant="secondary">수정</Button>
                <EditMeetingModal
                  meeting={meeting}
                />
              </Modal>

            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
