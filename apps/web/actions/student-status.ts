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
export type CreateStudentStatusState = {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string | string[]>;
  timestamp?: number;
};
export async function createStudentStatus(prevState: CreateStudentStatusState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentStatus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();
      const { studentUuid, ...data } = Object.fromEntries(formData.entries());

      const state: CreateStudentStatusState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }
      const { organization } = session;

      const validationResult = createSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const student = await prisma.student.findFirst({
        select: {
          id: true,
        },
        where: {
          uuid: studentUuid as string,
          organizationId: organization.id,
          deletedAt: null,
        },
      });

      if (!student) {
        state.message = '수강생 정보를 찾을 수 없습니다.';
        return state;
      }

      const lastStatus = await prisma.studentStatus.findFirst({
        select: {
          status: true,
        },
        where: {
          studentId: student.id,
          deletedAt: null,
        },
        orderBy: {
          changedAt: 'desc',
        },
      });

      if (lastStatus?.status === validationResult.data.status) {
        state.message = '현재 상태와 동일합니다.';
        return state;
      }

      await prisma.$transaction(async (tx) => {
        await tx.studentStatus.create({
          data: {
            studentId: student.id,
            ...validationResult.data,
          },
        });

        await tx.student.update({
          where: {
            id: student.id,
          },
          data: {
            status: validationResult.data.status,
            updatedAt: new Date(),
          },
        });
      });

      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '수강생의 상태를 변경하였습니다';
      return state;
    },
  );
}

const updateSchema = z.object({
  studentStatusId: z.coerce.number(),
  notes: z.string().optional(),
});

export type UpdateStudentStatusState = {
  success?: boolean;
  message?: string;
  fieldErrors?: Record<string, string | string[]>;
  timestamp?: number;
};

export async function updateStudentStatus(prevState: UpdateStudentStatusState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentStatus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      const state: UpdateStudentStatusState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }
      const { organization } = session;

      const validationResult = updateSchema.safeParse(Object.fromEntries(formData));
      if (!validationResult.success) {
        state.fieldErrors = validationResult.error.flatten().fieldErrors;
        return state;
      }

      // 해당 상태 기록이 현재 조직의 학생에 속하는지 확인
      const studentStatus = await prisma.studentStatus.findUnique({
        where: {
          id: validationResult.data.studentStatusId,
        },
        include: {
          student: true,
        },
      });

      if (!studentStatus || studentStatus.student.organizationId !== organization.id) {
        state.message = '권한이 없습니다';
        return state;
      }

      await prisma.studentStatus.update({
        where: {
          id: studentStatus.id,
        },
        data: {
          notes: validationResult.data.notes,
        },
      });

      revalidatePath('/students/[studentUuid]', 'page');
      state.success = true;
      state.message = '수정하였습니다';
      return state;
    },
  );
}
