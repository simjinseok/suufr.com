import * as React from 'react';
import { getUserSettings } from '@/utils/user-settings';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { dashboardApi } from '@/utils/api/dashboard';
import { parseMonthParam } from '@/utils/dashboard/month-param';
import SummaryCards from './_summary-cards';
import TodayBar from './_today-bar';
import MonthMatrix from './_month-matrix';

export default async function Page(props: PageProps<'/dashboard'>) {
  const [settings, searchParams] = await Promise.all([getUserSettings(), props.searchParams]);
  const timeZone = settings.timezone ?? DEFAULT_TIMEZONE;
  const rawMonth = Array.isArray(searchParams.month) ? searchParams.month[0] : searchParams.month;
  const month = parseMonthParam(rawMonth, timeZone);

  // 오늘 막대의 기준 시각 — 서버 렌더와 하이드레이션이 같은 값으로 첫 렌더를 하도록 넘긴다.
  // API 조회보다 먼저 잡아서, 조회가 자정을 넘기면 클라이언트가 새 날로 보고 다시 불러오게 한다
  const renderedAt = new Date().toISOString();
  // 카드·오늘 막대는 month와 무관하게 늘 오늘 기준(/api/dashboard), 매트릭스만 month를 따른다
  const [dashboard, matrix] = await Promise.all([
    dashboardApi.get(),
    dashboardApi.getMonth({ month }),
  ]);
  const { activeStudentCount, unpaidInvoices, todaySessions } = dashboard.data;
  const unpaidStudentUuids = [...new Set(unpaidInvoices.map(invoice => invoice.student.uuid))];

  return (
    <div className="mt-3" data-wide-page>
      <SummaryCards
        activeStudentCount={activeStudentCount}
        unpaidInvoices={unpaidInvoices}
        timezone={timeZone}
      />
      <TodayBar
        sessions={todaySessions}
        unpaidStudentUuids={unpaidStudentUuids}
        timezone={timeZone}
        renderedAt={renderedAt}
      />
      <MonthMatrix data={matrix.data} month={month} />
    </div>
  );
}
