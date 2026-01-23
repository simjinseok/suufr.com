'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { updateOrganizationSchema } from '@/schemas/organization';
import type { ServerActionState } from '@/types/index';
import { organizationsApi } from '@/utils/api/organizations';

type UpdateOrganizationFields = {
  name: string;
  phone?: string;
  address?: string;
  logoImageUrl?: string | null;
  profileName?: string | null;
  profileImageUrl?: string | null;
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
      const logoImageUrl = (data.logoImageUrl as string) || null;
      const profileImageUrl = (data.profileImageUrl as string) || null;
      const state: UpdateOrganizationState = {
        success: false,
        fields: {
          name: (data.name as string) || '',
          phone: (data.phone as string) || undefined,
          address: (data.address as string) || undefined,
          logoImageUrl,
          profileName: (data.profileName as string) || null,
          profileImageUrl,
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
          profileName: validation.data.profileName || undefined,
          profileImageUrl: validation.data.profileImageUrl,
          logoImageUrl: validation.data.logoImageUrl,
        });

        revalidatePath(`/organizations/${organizationUuid}/settings`);
        state.success = true;
        state.message = '조직 정보가 저장되었습니다';
        state.fields = {
          ...state.fields,
          logoImageUrl: response.data.logoImageUrl,
          profileName: response.data.profileName,
          profileImageUrl: response.data.profileImageUrl,
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
    return response.data;
  }
  catch {
    return null;
  }
}
