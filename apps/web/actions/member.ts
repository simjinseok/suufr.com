'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { addMemberSchema, updateMemberSchema } from '@/schemas/member';
import { moveMemberImage, deleteImage } from '@/utils/cloudinary';
function buildAssetUrl(key: string | null, folder: 'student' | 'member'): string | null {
  if (!key) return null;
  return `/assets/${folder}/${key}.webp`;
}
import type { ServerActionState } from '@/types/index';

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
      const session = await getSession();

      if (!session?.user?.id) {
        return {
          success: false,
          message: '로그인이 필요합니다',
          timestamp: Date.now(),
        };
      }

      // Owner 권한 확인
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organization: { uuid: organizationUuid },
          role: 'owner',
          deletedAt: null,
        },
        include: { organization: true },
      });

      if (!membership) {
        return {
          success: false,
          message: '권한이 없습니다',
          timestamp: Date.now(),
        };
      }

      const data = Object.fromEntries(formData);
      const profileImageKey = (data.profileImageKey as string) || null;
      const profileImagePublicId = (data.profileImagePublicId as string) || null;
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

      // 중복 이름 확인
      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: membership.organization.id,
          name: validation.data.name,
          deletedAt: null,
        },
      });

      if (existingMember) {
        state.message = '이미 동일한 이름의 멤버가 있습니다';
        return state;
      }

      try {
        // Move temp image to members folder
        let finalImageUrl = profileImageKey;
        if (profileImagePublicId && profileImagePublicId.includes('suufr/temp/')) {
          const movedUrl = await moveMemberImage(profileImagePublicId);
          if (movedUrl) {
            finalImageUrl = movedUrl;
          }
        }

        await prisma.organizationMember.create({
          data: {
            name: validation.data.name,
            role: 'teacher',
            profileImageKey: finalImageUrl,
            organizationId: membership.organization.id,
          },
        });

        revalidatePath(`/organizations/${organizationUuid}/settings/members`);
        state.success = true;
        state.message = '멤버가 추가되었습니다';
        state.fields = { name: '', profileImageKey: null };
      }
      catch (error) {
        state.message = '멤버 추가 중 오류가 발생했습니다';
        Sentry.captureException(error);
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
      const session = await getSession();

      if (!session?.user?.id) {
        return { success: false, message: '로그인이 필요합니다' };
      }

      // Owner 권한 확인
      const ownerMembership = await prisma.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organization: { uuid: organizationUuid },
          role: 'owner',
          deletedAt: null,
        },
        include: { organization: true },
      });

      if (!ownerMembership) {
        return { success: false, message: '권한이 없습니다' };
      }

      // 대상 멤버 확인
      const targetMember = await prisma.organizationMember.findFirst({
        where: {
          uuid: memberUuid,
          organizationId: ownerMembership.organization.id,
          deletedAt: null,
        },
      });

      if (!targetMember) {
        return { success: false, message: '멤버를 찾을 수 없습니다' };
      }

      // 자기 자신은 삭제 불가
      if (targetMember.userId === session.user.id) {
        return { success: false, message: '자신을 삭제할 수 없습니다' };
      }

      try {
        await prisma.organizationMember.update({
          where: { id: targetMember.id },
          data: { deletedAt: new Date() },
        });

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        return { success: true, message: '멤버가 삭제되었습니다' };
      }
      catch (error) {
        Sentry.captureException(error);
        return { success: false, message: '멤버 삭제 중 오류가 발생했습니다' };
      }
    },
  );
}

export async function getOrganizationMembers(organizationUuid: string) {
  const session = await getSession();

  if (!session?.user?.id) {
    return [];
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: { uuid: organizationUuid },
      deletedAt: null,
    },
    include: { organization: true },
  });

  if (!membership) {
    return [];
  }

  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: membership.organization.id,
      deletedAt: null,
    },
    orderBy: [
      { role: 'asc' }, // owner first
    ],
  });

  return members.map(member => ({
    id: member.id,
    uuid: member.uuid,
    name: member.name,
    role: member.role,
    status: member.status,
    profileImageUrl: buildAssetUrl(member.profileImageKey, 'member'),
    userId: member.userId,
    isLinked: !!member.userId,
    isSelf: member.userId === session.user.id,
  }));
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
      const session = await getSession();

      if (!session?.user?.id) {
        return {
          success: false,
          message: '로그인이 필요합니다',
          timestamp: Date.now(),
        };
      }

      // Owner 권한 확인
      const ownerMembership = await prisma.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organization: { uuid: organizationUuid },
          role: 'owner',
          deletedAt: null,
        },
        include: { organization: true },
      });

      if (!ownerMembership) {
        return {
          success: false,
          message: '권한이 없습니다',
          timestamp: Date.now(),
        };
      }

      // 대상 멤버 확인
      const targetMember = await prisma.organizationMember.findFirst({
        where: {
          uuid: memberUuid,
          organizationId: ownerMembership.organization.id,
          deletedAt: null,
        },
      });

      if (!targetMember) {
        return {
          success: false,
          message: '멤버를 찾을 수 없습니다',
          timestamp: Date.now(),
        };
      }

      const data = Object.fromEntries(formData);
      const profileImagePublicId = (data.profileImagePublicId as string) || null;
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

      // 중복 이름 확인 (자기 자신 제외)
      if (validation.data.name !== targetMember.name) {
        const existingMember = await prisma.organizationMember.findFirst({
          where: {
            organizationId: ownerMembership.organization.id,
            name: validation.data.name,
            deletedAt: null,
            NOT: { id: targetMember.id },
          },
        });

        if (existingMember) {
          state.message = '이미 동일한 이름의 멤버가 있습니다';
          return state;
        }
      }

      try {
        // Move temp image to members folder
        let finalImageKey = targetMember.profileImageKey; // 기존 값 유지
        const oldImageKey = targetMember.profileImageKey;

        if (profileImagePublicId && profileImagePublicId.includes('suufr/temp/')) {
          const newKey = await moveMemberImage(profileImagePublicId);
          if (newKey) {
            finalImageKey = newKey;
          }
        }

        await prisma.organizationMember.update({
          where: { id: targetMember.id },
          data: {
            name: validation.data.name,
            profileImageKey: finalImageKey,
          },
        });

        // 새 이미지가 저장된 경우, 이전 이미지 삭제
        if (finalImageKey !== oldImageKey && oldImageKey) {
          await deleteImage(oldImageKey, 'members');
        }

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        state.success = true;
        state.message = '멤버 정보가 수정되었습니다';
        state.fields = {
          name: validation.data.name,
          profileImageKey: finalImageKey,
          profileImageUrl: buildAssetUrl(finalImageKey, 'member'),
        };
      }
      catch (error) {
        state.message = '멤버 수정 중 오류가 발생했습니다';
        Sentry.captureException(error);
      }

      return state;
    },
  );
}
