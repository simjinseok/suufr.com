'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import {getSession} from "@/utils/auth";
const createSchema = z.object({
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
      const validationResult = createSchema.safeParse(data);
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

        await tx.studentStatusHistory.create({
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
