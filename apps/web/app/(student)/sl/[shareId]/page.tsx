import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { lessonsApi } from '@/utils/api';
import LessonView from './_lesson-view';

export const dynamic = 'force-dynamic';

export default async function SharedLessonPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  const share = await lessonsApi.getByShareId(shareId);
  if (!share?.data?.lesson) {
    return notFound();
  }

  const { lesson, expiresAt } = share.data;
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
          {/* 조직 로고 */}
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
          {/* 다음결제예정일 */}
          {nextPaymentAt && (
            <span className="text-xs text-gray-500">
              다음결제예정일:
              {' '}
              {format(new Date(nextPaymentAt), 'M월 d일', { locale: ko })}
            </span>
          )}
        </div>

        <LessonView lesson={lesson} teacher={teacher} />

        <footer className="mt-8 text-center text-sm text-gray-400">
          <p>
            이 링크는&nbsp;
            {new Date(expiresAt).toLocaleDateString('ko-KR')}
            까지
            유효합니다.
          </p>
        </footer>
      </div>
    </div>
  );
}
