import { getSession } from '@/utils/auth';

import AccountDeletionSection from '@/components/settings/account-deletion-section';
import TwoFactorSection from '@/components/settings/two-factor-section';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getSession();
  const user = session?.user;

  return (
    <div>
      <h1 className="text-2xl font-bold">보안 설정</h1>
      <p className="mt-2 text-gray-500">
        2단계 인증을 관리합니다. 계정 삭제도 여기서 할 수 있습니다.
      </p>
      <div className="mt-6 flex flex-col gap-6">
        <TwoFactorSection enabled={user?.twoFactorEnabled ?? false} />
        {/* hasPassword 가 없으면 계정 삭제를 모르는 api(배포 시차)라 재인증 방식을 고를 수 없다 */}
        {typeof user?.hasPassword === 'boolean' && (
          <AccountDeletionSection
            email={user.email}
            hasPassword={user.hasPassword}
            isPro={session?.subscription.plan === 'pro'}
          />
        )}
      </div>
    </div>
  );
}
