import { getSubscription } from '@/actions/subscription';

import CurrentPlanCard from './_current-plan-card';
import UsageCard from './_usage-card';
import PlanComparison from './_plan-comparison';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const subscription = await getSubscription();

  return (
    <div>
      <h1 className="text-2xl font-bold">요금제</h1>
      <div className="mt-6 flex flex-col gap-6">
        <CurrentPlanCard subscription={subscription} />
        <UsageCard subscription={subscription} />
        <PlanComparison subscription={subscription} />
      </div>
    </div>
  );
}
