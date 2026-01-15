'use server';
import prisma from '@/utils/prisma';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/utils/auth';

const createSchema = z.object({
  status: z.enum(['pending', 'active', 'paused', 'leave']).optional().default('pending'),
  notes: z.string().optional(),
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
  notes: z.string().optional(),
});

export type UpdateStudentStatusHistoryState = {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string | string[]>;
  timestamp?: number;
};

export async function updateStudentStatusHistory(prevState: UpdateStudentStatusHistoryState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentStatusHistory',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();

      const state: UpdateStudentStatusHistoryState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!user) {
        return state;
      }

      const validationResult = updateSchema.safeParse(Object.fromEntries(formData));
      if (!validationResult.success) {
        state.fieldErrors = validationResult.error.flatten().fieldErrors;
        return state;
      }

      // 해당 상태 기록이 현재 사용자의 학생에 속하는지 확인
      const history = await prisma.studentStatusHistory.findUnique({
        where: {
          id: validationResult.data.studentStatusHistoryId,
        },
        include: {
          student: true,
        },
      });

      if (!history || history.student.userId !== user.id) {
        state.message = '권한이 없습니다';
        return state;
      }

      await prisma.studentStatusHistory.update({
        where: {
          id: history.id,
        },
        data: {
          notes: validationResult.data.notes,
        },
      });

      revalidatePath('/students/[studentId]', 'page');
      state.success = true;
      state.message = '수정하였습니다';
      return state;
    },
  );
}
