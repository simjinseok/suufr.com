'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDate } from '@internationalized/date';
import { z } from 'zod';
import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';
import { moveImage } from '@/utils/cloudinary';

const createStudentSchema = z.object({
  name: z.string().trim().min(1, { error: '이름을 입력해주세요' }),
  notes: z.string(),
  status: z.enum(['pending', 'active', 'paused', 'leave']).optional().default('pending'),
});
export async function createStudent(prevState: any, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudent',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();

      const data = Object.fromEntries(formData);
      const obj: Record<string, any> = {
        success: false,
        fields: {
          name: data.name,
          status: data.status,
          notes: data.notes,
        },
        errors: [],
      };
      const validationResult = createStudentSchema.safeParse(data);
      if (!validationResult.success) {
        obj.errors = z.flattenError(validationResult.error).fieldErrors;
        return obj;
      }

      await prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            userId: user.id,
            ...validationResult.data,
          },
        });

        await tx.studentStatus.create({
          data: {
            studentId: student.id,
            status: validationResult.data.status,
            notes: '신규 수강생 등록',
          },
        });

        return student;
      });

      revalidatePath('/students', 'page');
      obj.success = true;
      return obj;
    },
  );
}

const updateStudentSchema = z.object({
  name: z.string().min(1),
  notes: z.string(),
  nextPaymentAt: z.string().optional(),
  profileImageUrl: z.string().url().nullable().optional(),
});

type UpdateStudentState = ServerActionState<{
  name: string;
  notes: string;
}>;
export async function updateStudent(prevState: UpdateStudentState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudent',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();
      const formEntries = Object.fromEntries(formData.entries());
      const { studentUuid, profileImageUrl: rawProfileImageUrl, profileImagePublicId: rawPublicId, ...data } = formEntries;
      let profileImageUrl = rawProfileImageUrl === '' ? null : rawProfileImageUrl;
      const publicId = typeof rawPublicId === 'string' && rawPublicId !== '' ? rawPublicId : null;
      const state: UpdateStudentState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!user) {
        return state;
      }

      const student = await prisma.student.findUnique({
        where: {
          uuid: studentUuid as string,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        return state;
      }

      const validationResult = updateStudentSchema.safeParse({
        ...data,
        profileImageUrl,
      });
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const { nextPaymentAt, profileImageUrl: validatedProfileImageUrl, ...restData } = validationResult.data;

      // 새 이미지가 임시 폴더에 업로드된 경우 정식 폴더로 이동
      let finalProfileImageUrl = validatedProfileImageUrl;
      if (publicId?.startsWith('suufr/temp/')) {
        const movedUrl = await moveImage(publicId);
        if (movedUrl) {
          finalProfileImageUrl = movedUrl;
        }
      }

      await prisma.student.update({
        where: {
          id: student.id,
        },
        data: {
          ...restData,
          profileImageUrl: finalProfileImageUrl,
          // 날짜만 저장하는 필드라서 UTC로 저장해야함. 아니면 하루가 깍임
          nextPaymentAt: nextPaymentAt ? parseDate(nextPaymentAt).toDate('UTC') : null,
          updatedAt: new Date(),
        },
      });

      revalidatePath('/students', 'page');
      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '수강생 정보를 수정하였습니다.';
      return state;
    },
  );
}

export default async function removeStudent(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeStudent',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const studentUuid = formData.get('studentUuid') as string;

      const { user } = await getSession();

      if (!user) {
        return { success: false };
      }

      const student = await prisma.student.findUnique({
        where: {
          uuid: studentUuid,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        return { success: false };
      }

      await prisma.student.update({
        where: {
          id: student.id,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      revalidatePath('/students', 'page');
      return {
        success: true,
      };
    },
  );
}
