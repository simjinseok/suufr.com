'use client';
import { createContext, useContext } from 'react';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';

// 서버가 해석한 유저 설정 타임존을 그대로 내려받아 SSR과 hydration이 항상 일치한다
const TimeZoneContext = createContext<string>(DEFAULT_TIMEZONE);

export function TimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string;
  children: React.ReactNode;
}) {
  return <TimeZoneContext value={timeZone}>{children}</TimeZoneContext>;
}

export function useTimeZone() {
  return useContext(TimeZoneContext);
}
