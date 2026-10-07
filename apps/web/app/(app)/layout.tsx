import { redirect } from 'next/navigation';
import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/utils/user-settings';
import { TimeFormatProvider } from '@/contexts/time-format';
import { TimeZoneProvider } from '@/contexts/timezone';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { ModalManagerProvider } from '@/contexts/modal-manager';
import { CloudFrontCookiesInitializer } from '@/components/cloudfront-cookies-initializer';
import { TimezoneInitializer } from '@/components/timezone-initializer';
import ReconsentModal from '@/components/consent/reconsent-modal';
import EmailVerificationBanner from '@/components/auth/email-verification-banner';
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
        {/* modal.show()로 띄우는 모달이 위 두 프로바이더 안에서 렌더되어야 한다.
          루트에 두면 형제로 렌더되어 타임존/시간형식이 기본값(UTC)으로 폴백한다. */}
        <ModalManagerProvider>
          {/* CloudFront 쿠키 초기화 (보호된 파일 접근용) */}
          <CloudFrontCookiesInitializer />
          {/* 타임존 미설정 시 브라우저 값으로 1회 자동 초기화 */}
          <TimezoneInitializer needsInit={!settings.timezone} />
          {/* 약관·개인정보 동의 이력이 없거나 문서 버전이 바뀐 경우 — 동의 전까지 앱 사용 차단 */}
          {session.consents.required && <ReconsentModal />}

          <div className="flex min-h-dvh bg-linear-to-br from-gray-50 via-gray-100 to-gray-50 sm:p-4 sm:gap-4">
            <Sidebar
              currentOrg={session.organization}
              organizations={session.organizations}
              plan={session.subscription.plan}
            />

            <main className="flex-1 overflow-auto pt-14 sm:pt-0">
              <div className="h-full">
                <div className="max-w-3xl mx-auto py-6 px-4 sm:px-2">
                  {/* 가입 직후 로그인된 미인증 계정 — 인증을 마칠 때까지 안내 (차단하지 않음) */}
                  {session.user.emailVerified === false && <EmailVerificationBanner email={session.user.email} />}
                  {children}
                </div>
              </div>
            </main>
          </div>
        </ModalManagerProvider>
      </TimeZoneProvider>
    </TimeFormatProvider>
  );
}
