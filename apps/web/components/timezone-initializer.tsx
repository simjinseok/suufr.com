'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initializeTimezone } from '@/actions/settings';

/**
 * 유저 설정에 타임존이 없으면 브라우저 타임존으로 1회 초기화하고
 * 서버 컴포넌트를 새 타임존 기준으로 다시 렌더한다.
 */
export function TimezoneInitializer({ needsInit }: { needsInit: boolean }) {
  const router = useRouter();
  const requested = useRef(false);

  useEffect(() => {
    if (!needsInit || requested.current) return;
    requested.current = true;

    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimeZone) return;

    initializeTimezone(browserTimeZone).then(() => router.refresh());
  }, [needsInit, router]);

  return null;
}
