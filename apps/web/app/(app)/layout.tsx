import { redirect } from 'next/navigation';
import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/utils/user-settings';
import { TimeFormatProvider } from '@/contexts/time-format';
import { TimeZoneProvider } from '@/contexts/timezone';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { CloudFrontCookiesInitializer } from '@/components/cloudfront-cookies-initializer';
import { TimezoneInitializer } from '@/components/timezone-initializer';
import { Sidebar } from './_sidebar';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // 세션이 없거나 organization이 없으면 로그인 페이지로
  if (!session) {
    redirect('/login');
  }

  const settings = await getUserSettings();

  return (
    <TimeFormatProvider use24HourFormat={settings.use24HourFormat} defaultDuration={settings.defaultDuration}>
    <TimeZoneProvider timeZone={settings.timezone ?? DEFAULT_TIMEZONE}>
      {/* CloudFront 쿠키 초기화 (보호된 파일 접근용) */}
      <CloudFrontCookiesInitializer />
      {/* 타임존 미설정 시 브라우저 값으로 1회 자동 초기화 */}
      <TimezoneInitializer needsInit={!settings.timezone} />

      <div className="flex min-h-dvh bg-linear-to-br from-gray-50 via-gray-100 to-gray-50 sm:p-4 sm:gap-4">
        <Sidebar
          currentOrg={session.organization}
          organizations={session.organizations}
          plan={session.subscription.plan}
        />

        <main className="flex-1 overflow-auto pt-14 sm:pt-0">
          <div className="h-full">
            <div className="max-w-3xl mx-auto py-6 px-4 sm:px-2">
              {children}
            </div>
          </div>
        </main>
      </div>
    </TimeZoneProvider>
    </TimeFormatProvider>
  );
}
