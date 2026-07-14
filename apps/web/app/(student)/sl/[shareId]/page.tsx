import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { tz } from '@date-fns/tz';
import { ko } from 'date-fns/locale/ko';
import { studentSharesApi } from '@/utils/api';
import { TimeZoneProvider } from '@/contexts/timezone';
import StudentView from './_student-view';
import LessonView from './_lesson-view';

export const dynamic = 'force-dynamic';

export default async function SharedPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  // 신규(학생 단위) 공유 먼저 조회하고, 없으면 구 레슨 공유로 폴백 (7일 내 자연 일몰)
  const share = await studentSharesApi.getByShareId(shareId).catch(() => null);

  if (share?.data) {
    const { student, showPayments, hasUnpaid, sessions, timezone, expiresAt } = share.data;
    const org = student.organization;

    const teacher = org.profileName
      ? {
          name: org.profileName,
          profileImageUrl: org.profileImageUrl,
        }
      : null;

    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-gray-50">
        <div className="max-w-2xl mx-auto py-8 px-4">
          {/* 카드 밖 상단: 조직 로고 + 다음결제예정일 */}
          <div className="flex items-start justify-between mb-4">
            {org.logoImageUrl
              ? (
                  <img
                    src={org.logoImageUrl}
                    alt={org.name}
                    className="h-30"
                  />
                )
              : (
                  <p className="text-sm font-medium text-gray-600">{org.name}</p>
                )}
            {showPayments && student.nextPaymentAt && (
              <span className="text-xs text-gray-500">
                다음결제예정일:
                {' '}
                {/* 달력 날짜(@db.Date) — 타임존 변환 없이 UTC 고정으로 표기 */}
                {format(new Date(student.nextPaymentAt), 'M월 d일', { locale: ko, in: tz('UTC') })}
              </span>
            )}
          </div>

          <TimeZoneProvider timeZone={timezone}>
            <StudentView
              studentName={student.name}
              sessions={sessions}
              showPayments={showPayments}
              hasUnpaid={hasUnpaid}
              teacher={teacher}
            />
          </TimeZoneProvider>

          <footer className="mt-8 text-center text-sm text-gray-400">
            <p>
              이 링크는&nbsp;
              {format(new Date(expiresAt), 'yyyy. M. d.', { in: tz(timezone) })}
              까지
              유효합니다.
            </p>
          </footer>
        </div>
      </div>
    );
  }

  // [레거시] 구 LessonShare 링크 — lessons drop 마이그레이션 때 함께 제거
  const legacyShare = await studentSharesApi.getByLegacyLessonShareId(shareId).catch(() => null);
  if (!legacyShare?.data?.lesson) {
    return notFound();
  }

  const { lesson, timezone, expiresAt } = legacyShare.data;
  const { organization: org } = lesson.student;

  const teacher = org.profileName
    ? {
        name: org.profileName,
        profileImageUrl: org.profileImageUrl,
      }
    : null;
  const organization = {
    name: org.name,
    logoUrl: org.logoImageUrl,
  };
  const nextPaymentAt = lesson.student.nextPaymentAt;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* 카드 밖 상단: 조직 로고 + 다음결제예정일 */}
        <div className="flex items-start justify-between mb-4">
          {organization.logoUrl
            ? (
                <img
                  src={organization.logoUrl}
                  alt={organization.name}
                  className="h-30"
                />
              )
            : (
                <p className="text-sm font-medium text-gray-600">{organization.name}</p>
              )}
          {nextPaymentAt && (
            <span className="text-xs text-gray-500">
              다음결제예정일:
              {' '}
              {/* 달력 날짜(@db.Date) — 타임존 변환 없이 UTC 고정으로 표기 */}
              {format(new Date(nextPaymentAt), 'M월 d일', { locale: ko, in: tz('UTC') })}
            </span>
          )}
        </div>

        <TimeZoneProvider timeZone={timezone}>
          <LessonView lesson={lesson} teacher={teacher} />
        </TimeZoneProvider>

        <footer className="mt-8 text-center text-sm text-gray-400">
          <p>
            이 링크는&nbsp;
            {format(new Date(expiresAt), 'yyyy. M. d.', { in: tz(timezone) })}
            까지
            유효합니다.
          </p>
        </footer>
      </div>
    </div>
  );
}
