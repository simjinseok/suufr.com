'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { getSession } from '@/utils/auth';
import { subscriptionsApi } from '@/utils/api/subscriptions';
import type { TSubscription } from '@/types/index';

export async function getSubscription(): Promise<TSubscription | null> {
  return await Sentry.withServerActionInstrumentation(
    'getSubscription',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session) {
        return null;
      }

      try {
        const result = await subscriptionsApi.get(session.organization?.uuid);
        return result.data;
      }
      catch (error) {
        console.error('Failed to get subscription:', error);
        return null;
      }
    },
  );
}
