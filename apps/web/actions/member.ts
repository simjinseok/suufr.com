'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { addMemberSchema, updateMemberSchema } from '@/schemas/member';
import type { ServerActionState } from '@/types/index';
import { membersApi } from '@/utils/api/members';

function buildAssetUrl(key: string | null, folder: 'student' | 'member'): string | null {
  if (!key) return null;
  return `/assets/${folder}/${key}.webp`;
}

type AddMemberFields = {
  name: string;
  profileImageKey: string | null;
};
type AddMemberState = ServerActionState<AddMemberFields>;

type UpdateMemberFields = {
  name: string;
  profileImageKey: string | null;
  profileImageUrl: string | null;
};
type UpdateMemberState = ServerActionState<UpdateMemberFields>;

export async function addMember(
  organizationUuid: string,
  prevState: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  return await Sentry.withServerActionInstrumentation(
    'addMember',
    {},
    async () => {
      const data = Object.fromEntries(formData);
      const profileImageKey = (data.profileImageKey as string) || null;
      const state: AddMemberState = {
        success: false,
        fields: {
          name: (data.name as string) || '',
          profileImageKey,
        },
        timestamp: Date.now(),
      };

      const validation = addMemberSchema.safeParse({
        ...data,
        profileImageKey: profileImageKey || null,
      });
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        await membersApi.create(organizationUuid, {
          name: validation.data.name,
        });

        revalidatePath(`/organizations/${organizationUuid}/settings/members`);
        state.success = true;
        state.message = '멤버가 추가되었습니다';
        state.fields = { name: '', profileImageKey: null };
      }
      catch (error: any) {
        if (error.message?.includes('already exists')) {
          state.message = '이미 동일한 이름의 멤버가 있습니다';
        }
        else {
          state.message = '멤버 추가 중 오류가 발생했습니다';
          Sentry.captureException(error);
        }
      }

      return state;
    },
  );
}

export async function deleteMember(organizationUuid: string, memberUuid: string) {
  return await Sentry.withServerActionInstrumentation(
    'deleteMember',
    {},
    async () => {
      try {
        await membersApi.remove(memberUuid);

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        return { success: true, message: '멤버가 삭제되었습니다' };
      }
      catch (error: any) {
        if (error.message?.includes('yourself')) {
          return { success: false, message: '자신을 삭제할 수 없습니다' };
        }
        Sentry.captureException(error);
        return { success: false, message: '멤버 삭제 중 오류가 발생했습니다' };
      }
    },
  );
}

export async function getOrganizationMembers(organizationUuid: string) {
  try {
    const response = await membersApi.listByOrganization(organizationUuid);
    return response.data.map(member => ({
      id: member.id,
      uuid: member.uuid,
      name: member.name,
      role: member.role,
      status: member.status,
      profileImageUrl: buildAssetUrl(member.profileImageKey, 'member'),
      userId: member.userId,
      isLinked: !!member.userId,
    }));
  }
  catch {
    return [];
  }
}

export async function updateMember(
  organizationUuid: string,
  memberUuid: string,
  prevState: UpdateMemberState,
  formData: FormData,
): Promise<UpdateMemberState> {
  return await Sentry.withServerActionInstrumentation(
    'updateMember',
    {},
    async () => {
      const data = Object.fromEntries(formData);
      const state: UpdateMemberState = {
        success: false,
        fields: {
          name: (data.name as string) || '',
          profileImageKey: null,
          profileImageUrl: null,
        },
        timestamp: Date.now(),
      };

      const validation = updateMemberSchema.safeParse({
        ...data,
      });
      if (!validation.success) {
        state.fieldErrors = z.flattenError(validation.error).fieldErrors;
        return state;
      }

      try {
        const response = await membersApi.update(memberUuid, {
          name: validation.data.name,
        });

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        state.success = true;
        state.message = '멤버 정보가 수정되었습니다';
        state.fields = {
          name: validation.data.name,
          profileImageKey: response.data.profileImageKey,
          profileImageUrl: buildAssetUrl(response.data.profileImageKey, 'member'),
        };
      }
      catch (error: any) {
        if (error.message?.includes('already exists')) {
          state.message = '이미 동일한 이름의 멤버가 있습니다';
        }
        else {
          state.message = '멤버 수정 중 오류가 발생했습니다';
          Sentry.captureException(error);
        }
      }

      return state;
    },
  );
}
