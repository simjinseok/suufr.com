'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { generateAppToken, hashToken } from '@/utils/app-token';
import { createAppTokenSchema } from '@/schemas/app-token';
import type { ServerActionState } from '@/types/index';
import type { TAppToken } from '@/types/index';

export async function listAppTokens(): Promise<TAppToken[]> {
  const session = await getSession();

  if (!session?.user?.id) {
    return [];
  }

  const tokens = await prisma.appToken.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return tokens.map(token => ({
    id: token.id,
    uuid: token.uuid,
    name: token.name,
    lastUsedAt: token.lastUsedAt,
    createdAt: token.createdAt,
  }));
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

      const session = await getSession();

      if (!session?.user?.id) {
        state.message = '로그인이 필요합니다';
        return state;
      }

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

      const token = generateAppToken();
      const tokenHash = hashToken(token);

      await prisma.appToken.create({
        data: {
          name: validationResult.data.name,
          tokenHash,
          userId: session.user.id,
        },
      });

      revalidatePath('/settings', 'page');

      state.success = true;
      state.message = '앱 토큰이 생성되었습니다';
      state.token = token;
      return state;
    },
  );
}

type RevokeAppTokenState = ServerActionState<Record<string, never>>;

export async function revokeAppToken(tokenId: number): Promise<RevokeAppTokenState> {
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

      const session = await getSession();

      if (!session?.user?.id) {
        state.message = '로그인이 필요합니다';
        return state;
      }

      const token = await prisma.appToken.findFirst({
        where: {
          id: tokenId,
          userId: session.user.id,
          deletedAt: null,
        },
      });

      if (!token) {
        state.message = '토큰을 찾을 수 없습니다';
        return state;
      }

      await prisma.appToken.update({
        where: { id: tokenId },
        data: { deletedAt: new Date() },
      });

      revalidatePath('/settings', 'page');

      state.success = true;
      state.message = '앱 토큰이 삭제되었습니다';
      return state;
    },
  );
}
