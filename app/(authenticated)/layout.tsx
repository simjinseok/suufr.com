import { redirect } from 'next/navigation';
import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/actions/settings';
import { TimeFormatProvider } from '@/contexts/time-format';
import { Sidebar } from './_sidebar';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // 세션이 없거나 organization이 없으면 로그인 페이지로
  // if (!session || !session.organization) {
  //   redirect('/login');
  // }

  const settings = await getUserSettings(session.user.id);

  return (
    <TimeFormatProvider use24HourFormat={settings.use24HourFormat} defaultDuration={settings.defaultDuration}>
      <div className="flex h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 sm:p-4 sm:gap-4">
        <Sidebar
          currentOrg={session.organization}
          organizations={session.organizations}
        />

        <main className="flex-1 overflow-auto pt-14 sm:pt-0">
          <div className="h-full">
            <div className="max-w-3xl mx-auto py-6 px-4 sm:px-2">
              {children}
            </div>
          </div>
        </main>
      </div>
    </TimeFormatProvider>
  );
}
