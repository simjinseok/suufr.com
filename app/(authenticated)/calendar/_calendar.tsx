'use client';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isSameDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { tz, TZDate } from '@date-fns/tz';
import { Button, Tabs } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarView } from './page';
import MonthView from './_month-view';
import WeekView from './_week-view';
import DayView from './_day-view';
import SessionDetailModal from './_session-detail-modal';

interface Lesson {
  id: string;
  sessionAt: string;
  isDone: boolean;
  notes: string | null;
  lesson: {
    student: {
      name: string;
    };
  };
}

interface CalendarProps {
  lessons: Lesson[];
  selectedDate: string;
  view: CalendarView;
}

const TIMEZONE = 'Asia/Seoul';

export default function Calendar({ lessons, selectedDate, view }: CalendarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateObj = new TZDate(selectedDate + 'T00:00:00', TIMEZONE);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);

  const goToDate = (date: Date, newView?: CalendarView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', format(date, 'yyyy-MM-dd'));
    if (newView) {
      params.set('view', newView);
    }
    router.push(`/calendar?${params.toString()}`);
  };

  const handleViewChange = (newView: CalendarView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    router.push(`/calendar?${params.toString()}`);
  };

  // Mobile navigation (day only)
  const goToPrevDay = () => goToDate(subDays(dateObj, 1), 'day');
  const goToNextDay = () => goToDate(addDays(dateObj, 1), 'day');
  const goToTodayMobile = () => goToDate(new TZDate(new Date(), TIMEZONE), 'day');

  // Desktop navigation (based on view)
  const goToPrev = () => {
    if (view === 'month') {
      goToDate(subMonths(dateObj, 1));
    }
    else if (view === 'week') {
      goToDate(subWeeks(dateObj, 1));
    }
    else {
      goToDate(subDays(dateObj, 1));
    }
  };

  const goToNext = () => {
    if (view === 'month') {
      goToDate(addMonths(dateObj, 1));
    }
    else if (view === 'week') {
      goToDate(addWeeks(dateObj, 1));
    }
    else {
      goToDate(addDays(dateObj, 1));
    }
  };

  const goToToday = () => goToDate(new TZDate(new Date(), TIMEZONE));

  // Format header based on view
  const getHeaderText = () => {
    if (view === 'month') {
      return format(dateObj, 'yyyy년 M월', { locale: ko });
    }
    else if (view === 'week') {
      const weekStart = startOfWeek(dateObj, { locale: ko });
      const weekEnd = endOfWeek(dateObj, { locale: ko });
      return `${format(weekStart, 'M월 d일', { locale: ko })} ~ ${format(weekEnd, 'M월 d일', { locale: ko })}`;
    }
    else {
      return format(dateObj, 'yyyy년 M월 d일 (E)', { locale: ko });
    }
  };

  // Filter lessons for mobile day view
  const dayLessons = lessons.filter((lesson) => {
    return isSameDay(new Date(lesson.sessionAt), dateObj, { in: tz(TIMEZONE) });
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile: Day view only */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button isIconOnly variant="light" onPress={goToPrevDay}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[140px] text-center">
              {format(dateObj, 'yyyy년 M월 d일 (E)', { locale: ko })}
            </h2>
            <Button isIconOnly variant="light" onPress={goToNextDay}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <Button variant="flat" size="sm" onPress={goToTodayMobile}>
            오늘
          </Button>
        </div>
        <div className="rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <DayView lessons={dayLessons} onSessionClick={setSelectedSessionId} />
        </div>
      </div>

      {/* Desktop: Month/Week/Day views */}
      <div className="hidden sm:block">
        {/* Header with view selector */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button isIconOnly variant="light" onPress={goToPrev}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-bold min-w-[200px] text-center text-zinc-900">
              {getHeaderText()}
            </h2>
            <Button isIconOnly variant="light" onPress={goToNext}>
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button variant="flat" size="sm" onPress={goToToday}>
              오늘
            </Button>
          </div>

          {/* View selector tabs */}
          <Tabs selectedKey={view}>
            <Tabs.ListContainer>
              <Tabs.List>
                <Tabs.Tab id="month" onPress={() => handleViewChange('month')}>
                  월
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="week" onPress={() => handleViewChange('week')}>
                  주
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="day" onPress={() => handleViewChange('day')}>
                  일
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>

        {/* View content */}
        <div className="rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          {view === 'month' && (
            <MonthView lessons={lessons} selectedDate={dateObj} onSessionClick={setSelectedSessionId} />
          )}
          {view === 'week' && (
            <WeekView lessons={lessons} selectedDate={dateObj} onSessionClick={setSelectedSessionId} />
          )}
          {view === 'day' && <DayView lessons={lessons} onSessionClick={setSelectedSessionId} />}
        </div>
      </div>

      {/* Session Detail Modal */}
      <SessionDetailModal
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
