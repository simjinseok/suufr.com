'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import prisma from '@/utils/prisma';
import { parseZonedDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';
import { getUserSettings } from './settings';

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

      // 수업 시간 (분)
      const lessonDuration = parseInt(formData.get('lessonDuration') as string, 10) || 60;

      // 다음결제예정일
      const nextPaymentAtStr = formData.get('nextPaymentAt') as string;

      // 트랜잭션으로 lesson과 session들을 함께 생성
      await prisma.$transaction(async (tx) => {
        // lesson 생성
        const lesson = await tx.lesson.create({
          data: {
            title: (formData.get('title') as string) || '',
            notes: (formData.get('notes') as string) || '',
            studentId: student.id,
          },
        });

        // session들이 있으면 생성
        if (lessonDates.length > 0) {
          await tx.session.createMany({
            data: lessonDates.map((dateString) => {
              const sessionAt = parseZonedDateTime(dateString).toDate();
              return {
                lessonId: lesson.id,
                notes: '',
                sessionAt,
                duration: lessonDuration,
              };
            }),
          });
        }

        // 다음결제예정일 업데이트 (설정에 따라)
        if (nextPaymentAtStr) {
          const settings = await getUserSettings(user.id);
          if (settings.autoUpdateNextPaymentAt) {
            await tx.student.update({
              where: { id: student.id },
              data: {
                nextPaymentAt: parseZonedDateTime(nextPaymentAtStr).toDate(),
              },
            });
          }
        }
      });
      revalidatePath('/lessons', 'page');
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
export async function updateLesson(state: UpdateLessonState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateLesson',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { lessonId, ...data } = Object.fromEntries(formData.entries());

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

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: Number(lessonId),
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
      });

      if (!lesson) {
        return state;
      }

      const result = await prisma.lesson.update({
        where: {
          id: lesson.id,
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

      revalidatePath('/lessons', 'page');
      state.success = true;
      return state;
    },
  );
}

type RemoveLessonState = ServerActionState<null>;
export async function removeLesson(prevState: any, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeLesson',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const lessonId = Number(formData.get('lessonId'));

      const state: RemoveLessonState = {
        success: false,
        timestamp: Date.now(),
      };
      const { user } = await getSession();

      if (!user) {
        return state;
      }

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: lessonId,
          deletedAt: null,
          student: {
            userId: user.id,
          },
        },
        include: {
          sessions: {
            where: {
              deletedAt: null,
              isDone: false,
            },
          },
        },
      });

      if (!lesson) {
        return { success: false };
      }

      // 활성화된 session이 있으면 삭제 불가
      if (lesson.sessions.length > 0) {
        state.message = '먼저 수업을 삭제해주세요';
        return state;
      }

      const result = await prisma.lesson.update({
        where: {
          id: lesson.id,
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
