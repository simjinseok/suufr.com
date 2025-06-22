'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseZonedDateTime } from '@internationalized/date';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';
const createSchema = z.object({
  studentId: z.coerce.number(),
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
  status: z.enum(['pending', 'active', 'paused', 'leave']).optional().default('pending'),
  notes: z.string(),
});
export async function createStudentStatusHistory(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentStatusHistory',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false };
      }

      const validationResult = createSchema.safeParse(Object.fromEntries(formData));
      if (!validationResult.success) {
        return { success: false, errors: validationResult.error.flatten().fieldErrors };
      }

      const student = await prisma.student.findFirst({
        select: {
          id: true,
          status: true,
        },
        where: {
          id: validationResult.data.studentId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        return { success: false };
      }

      const studentStatusHistory = await prisma.$transaction(async (tx) => {
        const statusHistory = await tx.studentStatusHistory.create({
          data: {
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
      return { success: true, studentStatusHistory };
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
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

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
