'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { createMemberStatusSchema, updateMemberStatusSchema } from '@/schemas/member-status';
import type { ServerActionState, TMemberStatus } from '@/types/index';
import type { MemberStatusValue } from '@/prisma/generated/client';

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

      // 현재 상태와 동일하면 거부
      if (targetMember.status === validation.data.status) {
        state.message = '현재 상태와 동일합니다';
        return state;
      }

      try {
        await prisma.$transaction([
          // 상태 이력 생성
          prisma.memberStatus.create({
            data: {
              status: validation.data.status as MemberStatusValue,
              notes: validation.data.notes || null,
              memberId: targetMember.id,
            },
          }),
          // 멤버 상태 업데이트
          prisma.organizationMember.update({
            where: { id: targetMember.id },
            data: { status: validation.data.status as MemberStatusValue },
          }),
        ]);

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        state.success = true;
        state.message = '상태가 변경되었습니다';
        state.fields = { status: '', notes: '' };
      }
      catch (error) {
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

      // 상태 이력 확인
      const statusHistory = await prisma.memberStatus.findFirst({
        where: {
          uuid: statusUuid,
          member: {
            organizationId: ownerMembership.organization.id,
            deletedAt: null,
          },
          deletedAt: null,
        },
      });

      if (!statusHistory) {
        return {
          success: false,
          message: '상태 이력을 찾을 수 없습니다',
          timestamp: Date.now(),
        };
      }

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
        await prisma.memberStatus.update({
          where: { id: statusHistory.id },
          data: { notes: validation.data.notes || null },
        });

        revalidatePath(`/organizations/[organizationUuid]/settings/@members`);
        state.success = true;
        state.message = '사유가 수정되었습니다';
      }
      catch (error) {
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
  const session = await getSession();

  if (!session?.user?.id) {
    return [];
  }

  // 조직 멤버 확인
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

  // 대상 멤버 확인
  const targetMember = await prisma.organizationMember.findFirst({
    where: {
      uuid: memberUuid,
      organizationId: membership.organization.id,
      deletedAt: null,
    },
  });

  if (!targetMember) {
    return [];
  }

  const statuses = await prisma.memberStatus.findMany({
    where: {
      memberId: targetMember.id,
      deletedAt: null,
    },
    orderBy: { changedAt: 'desc' },
  });

  return statuses.map(status => ({
    id: status.id,
    uuid: status.uuid,
    status: status.status,
    notes: status.notes,
    changedAt: status.changedAt,
  }));
}
