'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import type { ServerActionState } from '@/types/index';
import { apiClient } from '@/utils/api-client';

export interface GoogleConnectionStatus {
  connected: boolean;
  email?: string;
  lastCalendarSyncAt?: string | null;
  lastContactsSyncAt?: string | null;
}

interface GoogleConnectResponse {
  success: boolean;
  data: { authUrl: string };
}

interface GoogleStatusResponse {
  success: boolean;
  data: GoogleConnectionStatus;
}

interface GoogleSyncResponse {
  success: boolean;
  data: {
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  };
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  try {
    const response = await apiClient<GoogleStatusResponse>('/api/google/status');
    return response.data;
  }
  catch {
    return { connected: false };
  }
}

export async function getGoogleConnectUrl(): Promise<string | null> {
  try {
    const response = await apiClient<GoogleConnectResponse>('/api/google/connect');
    return response.data.authUrl;
  }
  catch {
    return null;
  }
}

type DisconnectGoogleState = ServerActionState<Record<string, never>>;

export async function disconnectGoogle(): Promise<DisconnectGoogleState> {
  return await Sentry.withServerActionInstrumentation(
    'disconnectGoogle',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: DisconnectGoogleState = {
        success: false,
        timestamp: Date.now(),
      };

      try {
        await apiClient('/api/google/disconnect', { method: 'DELETE' });

        revalidatePath('/settings/integrations', 'page');

        state.success = true;
        state.message = 'Google 계정 연결이 해제되었습니다';
        return state;
      }
      catch {
        state.message = 'Google 계정 연결 해제에 실패했습니다';
        return state;
      }
    },
  );
}

type SyncGoogleState = ServerActionState<Record<string, never>> & {
  result?: {
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  };
};

export async function syncGoogleCalendar(): Promise<SyncGoogleState> {
  return await Sentry.withServerActionInstrumentation(
    'syncGoogleCalendar',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: SyncGoogleState = {
        success: false,
        timestamp: Date.now(),
      };

      try {
        const response = await apiClient<GoogleSyncResponse>('/api/google/sync/calendar', {
          method: 'POST',
        });

        revalidatePath('/settings/integrations', 'page');

        state.success = true;
        state.message = '캘린더 동기화가 완료되었습니다';
        state.result = response.data;
        return state;
      }
      catch {
        state.message = '캘린더 동기화에 실패했습니다';
        return state;
      }
    },
  );
}

export async function syncGoogleContacts(): Promise<SyncGoogleState> {
  return await Sentry.withServerActionInstrumentation(
    'syncGoogleContacts',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: SyncGoogleState = {
        success: false,
        timestamp: Date.now(),
      };

      try {
        const response = await apiClient<GoogleSyncResponse>('/api/google/sync/contacts', {
          method: 'POST',
        });

        revalidatePath('/settings/integrations', 'page');

        state.success = true;
        state.message = '연락처 동기화가 완료되었습니다';
        state.result = response.data;
        return state;
      }
      catch {
        state.message = '연락처 동기화에 실패했습니다';
        return state;
      }
    },
  );
}

export async function syncGoogleAll(): Promise<SyncGoogleState> {
  return await Sentry.withServerActionInstrumentation(
    'syncGoogleAll',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: SyncGoogleState = {
        success: false,
        timestamp: Date.now(),
      };

      try {
        await apiClient('/api/google/sync/all', { method: 'POST' });

        revalidatePath('/settings/integrations', 'page');

        state.success = true;
        state.message = '전체 동기화가 완료되었습니다';
        return state;
      }
      catch {
        state.message = '동기화에 실패했습니다';
        return state;
      }
    },
  );
}
