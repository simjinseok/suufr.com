'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { createAppTokenSchema } from '@/schemas/app-token';
import type { ServerActionState } from '@/types/index';
import type { TAppToken } from '@/types/index';
import { appTokensApi } from '@/utils/api/app-tokens';

export async function listAppTokens(): Promise<TAppToken[]> {
  try {
    const response = await appTokensApi.list();
    return response.data.map(token => ({
      uuid: token.uuid,
      name: token.name,
      lastUsedAt: token.lastUsedAt ? new Date(token.lastUsedAt) : null,
      createdAt: new Date(token.createdAt),
    }));
  }
  catch {
    return [];
  }
}

type CreateAppTokenState = ServerActionState<{
  name: string;
}> & {
  token?: string;
};

export async function createAppToken(
  prevState: CreateAppTokenState,
  formData: FormData,
): Promise<CreateAppTokenState> {
  return await Sentry.withServerActionInstrumentation(
    'createAppToken',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const data = Object.fromEntries(formData.entries());

      const state: CreateAppTokenState = {
        success: false,
        fields: {
          name: String(data.name || ''),
        },
        timestamp: Date.now(),
      };

      const validationResult = createAppTokenSchema.safeParse(data);
      if (!validationResult.success) {
        const errors = validationResult.error.flatten().fieldErrors;
        state.fieldErrors = {};
        for (const [key, value] of Object.entries(errors)) {
          if (value) {
            state.fieldErrors[key] = value;
          }
        }
        return state;
      }

      try {
        const response = await appTokensApi.create({ name: validationResult.data.name });

        revalidatePath('/settings', 'page');

        state.success = true;
        state.message = '앱 토큰이 생성되었습니다';
        state.token = response.data.token;
        return state;
      }
      catch {
        state.message = '앱 토큰 생성에 실패했습니다';
        return state;
      }
    },
  );
}

type RevokeAppTokenState = ServerActionState<Record<string, never>>;

export async function revokeAppToken(uuid: string): Promise<RevokeAppTokenState> {
  return await Sentry.withServerActionInstrumentation(
    'revokeAppToken',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: RevokeAppTokenState = {
        success: false,
        timestamp: Date.now(),
      };

      try {
        await appTokensApi.remove(uuid);

        revalidatePath('/settings', 'page');

        state.success = true;
        state.message = '앱 토큰이 삭제되었습니다';
        return state;
      }
      catch {
        state.message = '토큰을 찾을 수 없습니다';
        return state;
      }
    },
  );
}
