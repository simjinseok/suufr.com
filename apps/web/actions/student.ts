'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDate } from '@internationalized/date';
import { z } from 'zod';
import { getSession } from '@/utils/auth';
import { moveImage, deleteImage } from '@/utils/cloudinary';
import { studentsApi, studentStatusesApi } from '@/utils/api';

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
      const session = await getSession();

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

      if (!session?.organization) {
        return obj;
      }

      const validationResult = createStudentSchema.safeParse(data);
      if (!validationResult.success) {
        obj.errors = z.flattenError(validationResult.error).fieldErrors;
        return obj;
      }

      const { data: student } = await studentsApi.create(session.organization.uuid, {
        name: validationResult.data.name,
        notes: validationResult.data.notes,
      });

      await studentStatusesApi.create(student.uuid, {
        status: validationResult.data.status,
        notes: '신규 수강생 등록',
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
  profileImageKey: z.string().nullable().optional(),
  phone: z.string().optional().transform(val => val === '' ? null : val),
  email: z.string().optional().transform(val => val === '' ? null : val),
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
      const session = await getSession();
      const formEntries = Object.fromEntries(formData.entries());
      const { studentUuid, profileImageKey: rawProfileImageUrl, profileImagePublicId: rawPublicId, ...data } = formEntries;
      let profileImageKey = rawProfileImageUrl === '' ? null : rawProfileImageUrl;
      const publicId = typeof rawPublicId === 'string' && rawPublicId !== '' ? rawPublicId : null;
      const state: UpdateStudentState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }

      const { data: student } = await studentsApi.get(studentUuid as string);

      const validationResult = updateStudentSchema.safeParse({
        ...data,
        profileImageKey,
      });
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const { nextPaymentAt, profileImageKey: validatedProfileImageUrl, ...restData } = validationResult.data;

      // 새 이미지가 임시 폴더에 업로드된 경우 정식 폴더로 이동
      let finalProfileImageKey = student.profileImageKey; // 기존 값 유지
      const oldImageKey = student.profileImageKey;

      if (publicId?.startsWith('suufr/temp/')) {
        const newKey = await moveImage(publicId);
        if (newKey) {
          finalProfileImageKey = newKey;
        }
      }

      await studentsApi.update(studentUuid as string, {
        ...restData,
        profileImageKey: finalProfileImageKey,
        nextPaymentAt: nextPaymentAt ? parseDate(nextPaymentAt).toDate('UTC').toISOString() : undefined,
      });

      // 새 이미지가 저장된 경우, 이전 이미지 삭제
      if (finalProfileImageKey !== oldImageKey && oldImageKey) {
        await deleteImage(oldImageKey, 'students');
      }

      revalidatePath('/students', 'page');
      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '수강생 정보를 수정하였습니다.';
      return state;
    },
  );
}

const updateStudentProfileImageSchema = z.object({
  profileImageKey: z.string().nullable().optional(),
});

type UpdateStudentProfileImageState = ServerActionState<{
  profileImageKey: string | null;
}>;
export async function updateStudentProfileImage(prevState: UpdateStudentProfileImageState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentProfileImage',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();
      const formEntries = Object.fromEntries(formData.entries());
      const { studentUuid, profileImageKey: rawProfileImageUrl, profileImagePublicId: rawPublicId } = formEntries;
      let profileImageKey = rawProfileImageUrl === '' ? null : rawProfileImageUrl;
      const publicId = typeof rawPublicId === 'string' && rawPublicId !== '' ? rawPublicId : null;
      const state: UpdateStudentProfileImageState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }

      const { data: student } = await studentsApi.get(studentUuid as string);

      const validationResult = updateStudentProfileImageSchema.safeParse({
        profileImageKey,
      });
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      // 새 이미지가 임시 폴더에 업로드된 경우 정식 폴더로 이동
      let finalProfileImageKey = student.profileImageKey; // 기존 값 유지
      const oldImageKey = student.profileImageKey;

      if (publicId?.startsWith('suufr/temp/')) {
        const newKey = await moveImage(publicId);
        if (newKey) {
          finalProfileImageKey = newKey;
        }
      }
      else if (profileImageKey === null || profileImageKey === '') {
        // 이미지 제거
        finalProfileImageKey = null;
      }

      await studentsApi.update(studentUuid as string, {
        profileImageKey: finalProfileImageKey,
      });

      // 새 이미지가 저장된 경우 또는 이미지가 제거된 경우, 이전 이미지 삭제
      if (finalProfileImageKey !== oldImageKey && oldImageKey) {
        await deleteImage(oldImageKey, 'students');
      }

      revalidatePath('/students', 'page');
      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '프로필 사진을 변경하였습니다.';
      return state;
    },
  );
}

const updateStudentNextPaymentAtSchema = z.object({
  nextPaymentAt: z.string().optional(),
});

type UpdateStudentNextPaymentAtState = ServerActionState<{
  nextPaymentAt: string | null;
}>;
export async function updateStudentNextPaymentAt(prevState: UpdateStudentNextPaymentAtState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentNextPaymentAt',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();
      const formEntries = Object.fromEntries(formData.entries());
      const { studentUuid, nextPaymentAt } = formEntries;
      const state: UpdateStudentNextPaymentAtState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }

      const validationResult = updateStudentNextPaymentAtSchema.safeParse({
        nextPaymentAt: nextPaymentAt === '' ? undefined : nextPaymentAt,
      });
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const { nextPaymentAt: validatedNextPaymentAt } = validationResult.data;

      await studentsApi.update(studentUuid as string, {
        nextPaymentAt: validatedNextPaymentAt ? parseDate(validatedNextPaymentAt).toDate('UTC').toISOString() : null,
      });

      revalidatePath('/students', 'page');
      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '다음 결제 예정일을 변경하였습니다.';
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

      const session = await getSession();

      if (!session?.organization) {
        return { success: false };
      }

      await studentsApi.remove(studentUuid);

      revalidatePath('/students', 'page');
      return {
        success: true,
      };
    },
  );
}
