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

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold">요금제</h1>
        {session?.organization && (
          <p className="mt-1 text-sm text-gray-500">
            {session.organization.name} 과외방의 구독을 관리해요. 구독은 과외방 단위로 적용됩니다.
          </p>
        )}
      </header>
      <div className="mt-6 flex flex-col gap-6">
        <CurrentPlanCard
          subscription={subscription}
          customerKey={session?.organization?.uuid ?? ''}
          customerEmail={session?.user.email}
          customerName={session?.user.name}
        />
        <UsageCard subscription={subscription} />
        <PlanComparison subscription={subscription} />
        <OrderHistory subscription={subscription} />
      </div>
    </div>
  );
}
