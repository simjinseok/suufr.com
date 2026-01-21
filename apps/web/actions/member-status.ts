'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { createMemberStatusSchema, updateMemberStatusSchema } from '@/schemas/member-status';
import type { ServerActionState, TMemberStatus } from '@/types/index';
import { memberStatusesApi } from '@/utils/api/member-statuses';

type CreateMemberStatusFields = {
  status: string;
  notes: string;
};
type CreateMemberStatusState = ServerActionState<CreateMemberStatusFields>;

export async function createMemberStatus(
  organizationUuid: string,
  memberUuid: string,
  prevState: CreateMemberStatusState,
  formData: FormData,
): Promise<CreateMemberStatusState> {
  return await Sentry.withServerActionInstrumentation(
    'createMemberStatus',
    {},
    async () => {
      const data = Object.fromEntries(formData);
      const state: CreateMemberStatusState = {
        success: false,
        fields: {
          status: (data.status as string) || '',
          notes: (data.notes as string) || '',
        },
        timestamp: Date.now(),
      };

      const validation = createMemberStatusSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        await memberStatusesApi.create(memberUuid, {
          status: validation.data.status as 'active' | 'paused' | 'leave',
          notes: validation.data.notes || undefined,
        });

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        state.success = true;
        state.message = '상태가 변경되었습니다';
        state.fields = { status: '', notes: '' };
      }
      catch (error: any) {
        state.message = '상태 변경 중 오류가 발생했습니다';
        Sentry.captureException(error);
      }

      return state;
    },
  );
}

type UpdateMemberStatusFields = {
  notes: string;
};
type UpdateMemberStatusState = ServerActionState<UpdateMemberStatusFields>;

export async function updateMemberStatus(
  organizationUuid: string,
  statusUuid: string,
  prevState: UpdateMemberStatusState,
  formData: FormData,
): Promise<UpdateMemberStatusState> {
  return await Sentry.withServerActionInstrumentation(
    'updateMemberStatus',
    {},
    async () => {
      const data = Object.fromEntries(formData);
      const state: UpdateMemberStatusState = {
        success: false,
        fields: {
          notes: (data.notes as string) || '',
        },
        timestamp: Date.now(),
      };

      const validation = updateMemberStatusSchema.safeParse(data);
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        await memberStatusesApi.update(statusUuid, {
          notes: validation.data.notes || undefined,
        });

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        state.success = true;
        state.message = '사유가 수정되었습니다';
      }
      catch (error: any) {
        state.message = '사유 수정 중 오류가 발생했습니다';
        Sentry.captureException(error);
      }

      return state;
    },
  );
}

export async function getMemberStatusHistory(
  organizationUuid: string,
  memberUuid: string,
): Promise<TMemberStatus[]> {
  try {
    const response = await memberStatusesApi.listByMember(memberUuid);
    return response.data.map(status => ({
      id: status.id,
      uuid: status.uuid,
      status: status.status,
      notes: status.notes,
      changedAt: new Date(status.changedAt),
    }));
  }
  catch {
    return [];
  }
}
