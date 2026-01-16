import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/actions/settings';
import { TimeFormatProvider } from '@/contexts/time-format';
import { Sidebar } from './_sidebar';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSession();
  const settings = await getUserSettings(user.id);

  return (
    <TimeFormatProvider timeFormat={settings.timeFormat} defaultDuration={settings.defaultDuration}>
      <div className="flex h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 sm:p-4 sm:gap-4">
        <Sidebar />

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
