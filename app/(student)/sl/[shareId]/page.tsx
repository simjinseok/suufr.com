import prisma from '@/utils/prisma';
import { notFound } from 'next/navigation';
import LessonView from './_lesson-view';

export const dynamic = 'force-dynamic';

function buildAssetUrl(key: string | null | undefined, folder: 'organization' | 'member'): string | null {
  if (!key) return null;
  return `/assets/${folder}/${key}.webp`;
}

export default async function SharedLessonPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  const share = await prisma.sessionShare.findUnique({
    where: {
      shareId,
      deletedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      lesson: {
        include: {
          student: {
            select: {
              name: true,
              nextPaymentAt: true,
            },
          },
          member: {
            select: {
              name: true,
              profileImageKey: true,
              organization: {
                select: {
                  name: true,
                  logoImageKey: true,
                },
              },
            },
          },
          payment: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
            },
          },
          sessions: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              sessionAt: 'asc',
            },
            include: {
              feedback: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!share || !share.lesson) {
    notFound();
  }

  const { member } = share.lesson;
  const teacher = member ? {
    name: member.name,
    profileImageUrl: buildAssetUrl(member.profileImageKey, 'member'),
  } : null;
  const organization = member?.organization ? {
    name: member.organization.name,
    logoUrl: buildAssetUrl(member.organization.logoImageKey, 'organization'),
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* 조직 정보 (카드 밖 최상단) */}
        {organization && (
          <div className="mb-4">
            {organization.logoUrl ? (
              <img
                src={organization.logoUrl}
                alt={organization.name}
                className="h-[120px]"
              />
            ) : (
              <p className="text-sm font-medium text-gray-600">{organization.name}</p>
            )}
          </div>
        )}

        <LessonView lesson={share.lesson} teacher={teacher} />

        <footer className="mt-8 text-center text-sm text-gray-400">
          <p>
            이 링크는{' '}
            {new Date(share.expiresAt).toLocaleDateString('ko-KR')}까지
            유효합니다.
          </p>
        </footer>
      </div>
    </div>
  );
}
