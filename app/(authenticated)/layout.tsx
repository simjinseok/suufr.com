import { Sidebar } from './_sidebar';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 p-4 gap-4">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="h-full">
          <div className="max-w-3xl mx-auto py-6 px-2 pt-14 sm:pt-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
