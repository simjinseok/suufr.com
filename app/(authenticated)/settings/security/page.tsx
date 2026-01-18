import { getSession } from '@/utils/auth';
import { listAppTokens } from '@/actions/app-token';

import AppTokensSection from '@/components/settings/app-tokens-section';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { user } = await getSession();
  const tokens = await listAppTokens();

  return (
    <div>
      <h1 className="text-2xl font-bold">보안 설정</h1>
      <p className="mt-2 text-gray-500">
        앱 토큰을 관리하고 외부 앱 연동을 설정합니다.
      </p>
      <div className="mt-6">
        <AppTokensSection tokens={tokens} userEmail={user.email} />
      </div>
    </div>
  );
}
