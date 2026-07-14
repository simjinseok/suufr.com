import { format } from 'date-fns/format';
import { tz } from '@date-fns/tz';

import * as React from 'react';
import { getUserSettings } from '@/utils/user-settings';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { Heading } from '@/components/heading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/table';
import { dashboardApi } from '@/utils/api/dashboard';
import DashboardCards from './_dashboard-cards';

export default async function Page() {
  const settings = await getUserSettings();
  const timeZone = settings.timezone ?? DEFAULT_TIMEZONE;
  const response = await dashboardApi.get();
  const {
    activeStudentCount,
    unpaidStudents,
    needsPriceInvoices,
    leftStudentsCount,
    uncheckedMeetings,
  } = response.data;

  return (
    <div>
      <DashboardCards
        currentActiveStudentCount={activeStudentCount}
        leftStudentsCount={leftStudentsCount}
        unpaidStudents={unpaidStudents}
        needsPriceInvoices={needsPriceInvoices}
      />

      {uncheckedMeetings.length > 0 && (
        <div className="mt-12">
          <Heading>연락이 필요한 상담내역</Heading>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>날짜</TableHeader>
                <TableHeader>이름</TableHeader>
                <TableHeader>연락처</TableHeader>
                <TableHeader>내용</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {uncheckedMeetings.map(meeting => (
                <TableRow key={meeting.uuid}>
                  <TableCell>{format(new Date(meeting.meetingAt), 'yyyy-MM-dd', { in: tz(timeZone) })}</TableCell>
                  <TableCell>{meeting.name}</TableCell>
                  <TableCell>{meeting.phone}</TableCell>
                  <TableCell className="whitespace-pre-wrap">
                    {meeting.notes}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
