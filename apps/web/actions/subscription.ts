'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/utils/auth';
import { subscriptionsApi } from '@/utils/api/subscriptions';
import { ApiError } from '@/utils/api-client';
import type { TSubscription } from '@/types/index';

type BillingActionResult = {
  success: boolean;
  message?: string;
};

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
        const result = await subscriptionsApi.get();
        return result.data;
      }
      catch (error) {
        console.error('Failed to get subscription:', error);
        return null;
      }
    },
  );
}

export async function getInvoiceUrl(paddleTransactionId: string): Promise<BillingActionResult & { url?: string }> {
  return await Sentry.withServerActionInstrumentation(
    'getInvoiceUrl',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session) {
        return { success: false, message: '로그인이 필요합니다.' };
      }

      try {
        const result = await subscriptionsApi.invoice(paddleTransactionId);
        return { success: true, url: result.data.url };
      }
      catch (error) {
        if (error instanceof ApiError) {
          return { success: false, message: error.message };
        }
        throw error;
      }
    },
  );
}

export async function cancelSubscription(): Promise<BillingActionResult> {
  return await Sentry.withServerActionInstrumentation(
    'cancelSubscription',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session) {
        return { success: false, message: '로그인이 필요합니다.' };
      }

      try {
        await subscriptionsApi.cancel();
        revalidatePath('/settings/subscription', 'page');
        return { success: true };
      }
      catch (error) {
        if (error instanceof ApiError) {
          return { success: false, message: error.message };
        }
        throw error;
      }
    },
  );
}

export async function resumeSubscription(): Promise<BillingActionResult> {
  return await Sentry.withServerActionInstrumentation(
    'resumeSubscription',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session) {
        return { success: false, message: '로그인이 필요합니다.' };
      }

      try {
        await subscriptionsApi.resume();
        revalidatePath('/settings/subscription', 'page');
        return { success: true };
      }
      catch (error) {
        if (error instanceof ApiError) {
          return { success: false, message: error.message };
        }
        throw error;
      }
    },
  );
}
