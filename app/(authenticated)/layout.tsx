import { AppNavigation } from '@/components/app-navigation';
import { getSession } from '@/utils/auth';
import { UserMenu } from './_user-menu';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 p-4 gap-4">
      <aside
        className="w-72 flex flex-col rounded-2xl
                     bg-white/70 backdrop-blur-xl
                     border border-white/60
                     shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
      >
        <div className="h-16 flex items-center px-5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600
                          flex items-center justify-center shadow-lg shadow-indigo-500/30"
            >
              <span className="text-sm font-bold text-white">스</span>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">스프</h1>
          </div>
        </div>

        <AppNavigation />

        <UserMenu />
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="h-full">
          <div className="max-w-3xl mx-auto py-6 px-2">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
