'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { updateOrganizationSchema } from '@/schemas/organization';
import { moveOrganizationLogo, deleteImage } from '@/utils/cloudinary';
import type { ServerActionState } from '@/types/index';

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
      const logoImageKey = (data.logoImageKey as string) || null;
      const logoImagePublicId = (data.logoImagePublicId as string) || null;
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
        const oldLogoImageKey = membership.organization.logoImageKey;
        let finalLogoImageKey = oldLogoImageKey;

        // 로고 이미지 처리
        if (logoImagePublicId && logoImagePublicId.includes('suufr/temp/')) {
          // 새 이미지 업로드 (temp -> organizations 폴더로 이동)
          const newKey = await moveOrganizationLogo(logoImagePublicId);
          if (newKey) {
            finalLogoImageKey = newKey;
          }
        }
        else if (logoImageKey === '' && oldLogoImageKey) {
          // 이미지 삭제 요청
          finalLogoImageKey = null;
        }

        await prisma.organization.update({
          where: { id: membership.organization.id },
          data: {
            name: validation.data.name,
            phone: validation.data.phone || null,
            address: validation.data.address || null,
            logoImageKey: finalLogoImageKey,
          },
        });

        // 새 이미지로 교체된 경우 이전 이미지 삭제
        if (finalLogoImageKey !== oldLogoImageKey && oldLogoImageKey) {
          await deleteImage(oldLogoImageKey, 'organizations');
        }

        revalidatePath(`/organizations/${organizationUuid}/settings`);
        state.success = true;
        state.message = '조직 정보가 저장되었습니다';
        state.fields = {
          ...state.fields,
          logoImageKey: finalLogoImageKey,
          logoUrl: buildAssetUrl(finalLogoImageKey, 'organization'),
        };
      }
      catch (error) {
        state.message = '조직 정보 저장 중 오류가 발생했습니다';
        Sentry.captureException(error);
      }

      return state;
    },
  );
}

export async function getOrganization(organizationUuid: string) {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
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
    return null;
  }

  const { organization } = membership;

  return {
    ...organization,
    logoUrl: buildAssetUrl(organization.logoImageKey, 'organization'),
  };
}
