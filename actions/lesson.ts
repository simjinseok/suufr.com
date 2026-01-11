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
export async function updateSyllabus(state: UpdateLessonState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateSyllabus',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const syllabusId = Number(formData.get('syllabusId'));

      const state: UpdateLessonState = {
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
      });

      if (!syllabus) {
        return state;
      }

      const result = await prisma.syllabus.update({
        where: {
          id: syllabus.id,
        },
        data: {
          title: formData.get('title') as string,
          notes: formData.get('notes') as string,
          updatedAt: new Date(),
        },
      });

      revalidatePath('/lessons', 'page');
      state.success = true;
      return state;
    },
  );
}

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

      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { success: false };
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
        return { success: false, error: 'ACTIVE_LESSONS_EXIST' };
      }

      await prisma.syllabus.update({
        where: {
          id: syllabus.id,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      revalidatePath('/syllabuses', 'page');
      return { success: true };
    });
}
