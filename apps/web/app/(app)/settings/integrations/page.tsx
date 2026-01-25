import { getGoogleConnectionStatus, getGoogleConnectUrl } from '@/actions/google';

import GoogleConnectionCard from '@/components/settings/google-connection-card';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [status, authUrl] = await Promise.all([
    getGoogleConnectionStatus(),
    getGoogleConnectUrl(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">연동 설정</h1>
      <p className="mt-2 text-gray-500">
        외부 서비스와 연동하여 데이터를 동기화합니다.
      </p>
      <div className="mt-6 flex flex-col gap-6">
        <GoogleConnectionCard
          status={status}
          authUrl={authUrl}
          callbackResult={params.success ? 'success' : params.error ? params.error : null}
        />
      </div>
    </div>
  );
}
