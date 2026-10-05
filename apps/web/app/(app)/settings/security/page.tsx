import { getSession } from '@/utils/auth';
import { listAppTokens } from '@/actions/app-token';

import AppTokensSection from '@/components/settings/app-tokens-section';
import TwoFactorSection from '@/components/settings/two-factor-section';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  const user = session?.user;
  const tokens = await listAppTokens();

  return (
    <div>
      <h1 className="text-2xl font-bold">보안 설정</h1>
      <p className="mt-2 text-gray-500">
        2단계 인증과 앱 토큰을 관리하고 외부 앱 연동을 설정합니다.
      </p>
      <div className="mt-6 flex flex-col gap-6">
        <TwoFactorSection enabled={user?.twoFactorEnabled ?? false} requiresSetup={user?.requiresTwoFactorSetup ?? false} />
        <AppTokensSection tokens={tokens} userEmail={user?.email} />
      </div>
    </div>
  );
}
