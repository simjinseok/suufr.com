'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import { parseZonedDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';

type CreateLessonState = ServerActionState;
export async function createLesson(prevState: CreateLessonState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createLesson',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();
      const { studentId, ...data } = Object.fromEntries(formData.entries());

      const state: CreateLessonState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!user?.id) {
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

      // lesson[idx] 형식의 데이터 추출
      const lessonDates: string[] = [];
      for (const [key, value] of formData.entries()) {
        if (/^lesson\[\d+\]$/.test(key) && typeof value === 'string' && value) {
          lessonDates.push(value);
        }
      }

      // 트랜잭션으로 syllabus와 lesson들을 함께 생성
      await prisma.$transaction(async (tx) => {
        // syllabus 생성
        const syllabus = await tx.syllabus.create({
          data: {
            title: (formData.get('title') as string) || '',
            notes: (formData.get('notes') as string) || '',
            studentId: student.id,
          },
        });

        // lesson들이 있으면 생성
        if (lessonDates.length > 0) {
          await tx.lesson.createMany({
            data: lessonDates.map((dateString) => {
              const lessonAt = parseZonedDateTime(dateString).toDate();
              return {
                syllabusId: syllabus.id,
                notes: '',
                lessonAt,
              };
            }),
          });
        }
      });
      revalidatePath('/syllabuses', 'page');
      state.success = true;
      state.message = '레슨을 추가하였습니다';
      return state;
    });
}

type UpdateLessonState = ServerActionState<{
  title: string;
  notes: string;
}>;
const updateLessonSchema = z.object({
  title: z.string().min(1, { error: '제목을 입력해주세요' }),
  notes: z.string(),
});
export async function updateSyllabus(state: UpdateLessonState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateSyllabus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { syllabusId, ...data } = Object.fromEntries(formData.entries());

      const state: UpdateLessonState = {
        success: false,
        fields: {
          title: data.title as string,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };
      const { user } = await getSession();

      if (!user) {
        return state;
      }

      const validationResult = updateLessonSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const syllabus = await prisma.syllabus.findUnique({
        where: {
          id: Number(syllabusId),
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
      });

      if (!syllabus) {
        return state;
      }

      const result = await prisma.syllabus.update({
        where: {
          id: syllabus.id,
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
        data: {
          title: validationResult.data.title,
          notes: validationResult.data.notes,
          updatedAt: new Date(),
        },
      });

      console.log('?', result);
      revalidatePath('/lessons', 'page');
      state.success = true;
      return state;
    },
  );
}

type RemoveLessonState = ServerActionState<null>;
export async function removeLesson(prevState: RemoveLessonState, formData: FormData) {}
export async function removeSyllabus(prevState: any, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeSyllabus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const syllabusId = Number(formData.get('syllabusId'));

      const state: RemoveLessonState = {
        success: false,
        timestamp: Date.now(),
      };
      const { user } = await getSession();

      if (!user) {
        return state;
      }

      const syllabus = await prisma.syllabus.findUnique({
        where: {
          id: syllabusId,
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
        include: {
          lessons: {
            where: {
              deletedAt: null,
              isDone: false,
            },
          },
        },
      });

      if (!syllabus) {
        return { success: false };
      }

      // 활성화된 lesson이 있으면 삭제 불가
      if (syllabus.lessons.length > 0) {
        state.message = '먼저 수업을 삭제해주세요';
        return state;
      }

      const result = await prisma.syllabus.update({
        where: {
          id: syllabus.id,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (result) {
        revalidatePath('/students/[studentId]/@lessons', 'page');
        state.success = true;
        state.message = '수업을 삭제하였습니다';
        return state;
      }

      return state;
    });
}
