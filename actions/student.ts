'use server';
import type { ServerActionState } from '@/types/index';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDate } from '@internationalized/date';
import { z } from 'zod';
import prisma from '@/utils/prisma';
import { getSession } from '@/utils/auth';

const updateStudentSchema = z.object({
  name: z.string().min(1),
  notes: z.string(),
});

type UpdateStudentState = ServerActionState<{

}>;
export async function updateStudent(prevState: UpdateStudentState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudent',
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

const createSchema = z.object({
  changedAt: z.string().transform((val, ctx) => {
    try {
      const parsed = parseDate(val);
      return parsed.toDate('Asia/Seoul');
    }
    catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: '유효하지 않은 날짜 형식입니다',
      });
      return z.NEVER;
    }
  }),
  status: z.enum(['pending', 'active', 'paused', 'leave']).optional().default('pending'),
  notes: z.string(),
});
export type CreateStudentStatusHistoryState = {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string | string[]>;
  timestamp?: number;
};
export async function createStudentStatusHistory(prevState: CreateStudentStatusHistoryState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentStatusHistory',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();
      const { studentId, ...data } = Object.fromEntries(formData.entries());

      const state: CreateStudentStatusHistoryState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!user) {
        return state;
      }

      const validationResult = createSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }
      console.log('아니 왜? data', data);
      console.log('result', validationResult.data);

      const student = await prisma.student.findFirst({
        select: {
          id: true,
          status: true,
        },
        where: {
          id: Number(studentId),
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        state.message = '수강생 정보를 찾을 수 없습니다.';
        return state;
      }

      const studentStatusHistory = await prisma.$transaction(async (tx) => {
        const statusHistory = await tx.studentStatusHistory.create({
          data: {
            studentId: student.id,
            ...validationResult.data,
          },
        });

        const result = await tx.student.update({
          where: {
            id: student.id,
          },
          data: {
            status: validationResult.data.status,
            updatedAt: new Date(),
          },
        });

        return statusHistory;
      });

      revalidatePath('/students/[studentId]', 'page');
      state.success = true;
      state.message = '수강생의 상태를 변경하였습니다';
      return state;
    },
  );
}

const updateSchema = z.object({
  studentStatusHistoryId: z.coerce.number(),
  changedAt: z.string().transform((val, ctx) => {
    try {
      const parsed = parseZonedDateTime(val);
      return parsed.toDate();
    }
    catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '유효하지 않은 날짜 형식입니다',
      });
      return z.NEVER;
    }
  }),
  notes: z.string(),
});

export async function updateStudentStatusHistory(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentStatusHistory',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();

      if (!user) {
        return { success: false };
      }

      const validationResult = updateSchema.safeParse(Object.fromEntries(formData));
      if (!validationResult.success) {
        return { success: false, errors: validationResult.error.flatten().fieldErrors };
      }

      const updatedStatusHistory = await prisma.studentStatusHistory.update({
        where: {
          id: validationResult.data.studentStatusHistoryId,
        },
        data: {
          changedAt: validationResult.data.changedAt,
          notes: validationResult.data.notes,
        },
      });

      revalidatePath('/students/[studentId]', 'page');
      return { success: true, studentStatusHistory: updatedStatusHistory };
    },
  );
}
