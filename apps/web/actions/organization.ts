'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { updateOrganizationSchema } from '@/schemas/organization';
import type { ServerActionState } from '@/types/index';
import { organizationsApi } from '@/utils/api/organizations';

function buildAssetUrl(key: string | null, folder: 'organization'): string | null {
  if (!key) return null;
  return `/assets/${folder}/${key}.webp`;
}

type UpdateOrganizationFields = {
  name: string;
  phone?: string;
  address?: string;
  logoImageKey?: string | null;
  logoUrl?: string | null;
};
type UpdateOrganizationState = ServerActionState<UpdateOrganizationFields>;

export async function updateOrganization(
  organizationUuid: string,
  prevState: UpdateOrganizationState,
  formData: FormData,
): Promise<UpdateOrganizationState> {
  return await Sentry.withServerActionInstrumentation(
    'updateOrganization',
    {},
    async () => {
      const data = Object.fromEntries(formData);
      const logoImageKey = (data.logoImageKey as string) || null;
      const state: UpdateOrganizationState = {
        success: false,
        fields: {
          name: (data.name as string) || '',
          phone: (data.phone as string) || undefined,
          address: (data.address as string) || undefined,
          logoImageKey,
          logoUrl: null,
        },
        timestamp: Date.now(),
      };

      const validation = updateOrganizationSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await organizationsApi.update(organizationUuid, {
          name: validation.data.name,
          phone: validation.data.phone || undefined,
          address: validation.data.address || undefined,
        });

        revalidatePath(`/organizations/${organizationUuid}/settings`);
        state.success = true;
        state.message = '조직 정보가 저장되었습니다';
        state.fields = {
          ...state.fields,
          logoImageKey: response.data.logoImageKey,
          logoUrl: buildAssetUrl(response.data.logoImageKey, 'organization'),
        };
      }
      catch (error: any) {
        state.message = '조직 정보 저장 중 오류가 발생했습니다';
        Sentry.captureException(error);
      }

      return state;
    },
  );
}

export async function getOrganization(organizationUuid: string) {
  try {
    const response = await organizationsApi.get(organizationUuid);
    const organization = response.data;

    return {
      ...organization,
      logoUrl: buildAssetUrl(organization.logoImageKey, 'organization'),
    };
  }
  catch {
    return null;
  }
}
