import { getSession } from '@/utils/auth';
import { getSubscription } from '@/actions/subscription';

import CurrentPlanCard from './_current-plan-card';
import UsageCard from './_usage-card';
import PlanComparison from './_plan-comparison';
import OrderHistory from './_order-history';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [session, subscription] = await Promise.all([
    getSession(),
    getSubscription(),
  ]);

  // 빌드 타임 인라인(NEXT_PUBLIC_*) 대신 요청 시점에 서버 env를 읽어 내려준다
  // — 배포 파이프라인 재빌드 없이 런타임 env로 관리 가능
  const paddle = process.env.PADDLE_CLIENT_TOKEN && process.env.PADDLE_PRICE_ID_PRO
    ? {
        clientToken: process.env.PADDLE_CLIENT_TOKEN,
        environment: process.env.PADDLE_ENV === 'production' ? 'production' as const : 'sandbox' as const,
        priceIdPro: process.env.PADDLE_PRICE_ID_PRO,
      }
    : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">요금제</h1>
      <div className="mt-6 flex flex-col gap-6">
        <CurrentPlanCard
          subscription={subscription}
          userId={session?.user.id ?? ''}
          customerEmail={session?.user.email}
          paddle={paddle}
        />
        <UsageCard subscription={subscription} />
        <PlanComparison subscription={subscription} />
        <OrderHistory subscription={subscription} />
      </div>
    </div>
  );
}
