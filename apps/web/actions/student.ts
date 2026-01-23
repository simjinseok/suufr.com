'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDate } from '@internationalized/date';
import { z } from 'zod';
import { getSession } from '@/utils/auth';
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
  profileImageUrl: z.string().nullable().optional(),
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
      const { studentUuid, profileImageUrl: rawProfileImageUrl, ...data } = formEntries;
      const profileImageUrl = rawProfileImageUrl === '' ? null : rawProfileImageUrl;
      const state: UpdateStudentState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
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

      await studentsApi.update(studentUuid as string, {
        ...restData,
        profileImageUrl: validatedProfileImageUrl,
        nextPaymentAt: nextPaymentAt ? parseDate(nextPaymentAt).toDate('UTC').toISOString() : undefined,
      });

      revalidatePath('/students', 'page');
      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '수강생 정보를 수정하였습니다.';
      return state;
    },
  );
}

const updateStudentProfileImageSchema = z.object({
  profileImageUrl: z.string().nullable().optional(),
});

type UpdateStudentProfileImageState = ServerActionState<{
  profileImageUrl: string | null;
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
      const { studentUuid, profileImageUrl: rawProfileImageUrl } = formEntries;
      const profileImageUrl = rawProfileImageUrl === '' ? null : rawProfileImageUrl;
      const state: UpdateStudentProfileImageState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }

      const validationResult = updateStudentProfileImageSchema.safeParse({
        profileImageUrl,
      });
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      // API에서 temp → images 이동 및 기존 이미지 삭제 처리
      await studentsApi.update(studentUuid as string, {
        profileImageUrl: validationResult.data.profileImageUrl,
      });

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
