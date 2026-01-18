'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDate } from '@internationalized/date';
import { z } from 'zod';
import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';

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
});

type UpdateStudentState = ServerActionState<{

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
      const { studentId, ...data } = Object.fromEntries(formData.entries());
      const state: UpdateStudentState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!user) {
        return state;
      }

      const student = await prisma.student.findUnique({
        where: {
          id: Number(studentId),
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        return state;
      }

      const validationResult = updateStudentSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const result = await prisma.student.update({
        where: {
          id: student.id,
        },
        data: {
          ...validationResult.data,
          updatedAt: new Date(),
        },
      });

      revalidatePath('/students', 'page');
      revalidatePath('/students/[studentId]', 'page');
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
      const studentId = Number(formData.get('studentId'));

      const { user } = await getSession();

      if (!user) {
        return { success: false };
      }

      const student = await prisma.student.findUnique({
        where: {
          id: studentId,
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
