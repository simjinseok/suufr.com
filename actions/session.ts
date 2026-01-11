'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';

type CreateSessionState = {
  success: boolean;
  fields?: {
    isDone: boolean;
    lessonAt: string;
    notes: string;
  };
  timestamp: number;
};

export async function createSession(prevState: CreateSessionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createSession',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { lessonId, ...data } = Object.fromEntries(formData.entries());
      const state: CreateSessionState = {
        success: false,
        fields: {
          isDone: data.isDone === 'on',
          lessonAt: data.lessonAt as string,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.user) {
        return state;
      }

      const syllabus = await prisma.syllabus.findUnique({
        where: {
          id: Number(lessonId),
          deletedAt: null,
          student: {
            userId: session.user.id,
          },
        },
      });

      if (!syllabus) {
        return state;
      }

      await prisma.lesson.create({
        data: {
          syllabusId: Number(lessonId),
          isDone: data.isDone === 'on',
          notes: data.notes as string,
          lessonAt: parseDateTime(data.lessonAt as string).toDate('Asia/Seoul'),
        },
      });

      revalidatePath('/sessions', 'page');
      revalidatePath('/lessons', 'page');
      revalidatePath('/students', 'page');

      state.success = true;
      return state;
    },
  );
}

type UpdateSessionState = {
  success?: boolean;
  message?: string;
  timestamp?: number;
};

export async function updateSession(prevState: UpdateSessionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateSession',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { sessionId, ...data } = Object.fromEntries(formData.entries());

      const state: UpdateSessionState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.user) {
        return state;
      }

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: Number(sessionId),
          deletedAt: null,
          syllabus: {
            deletedAt: null,
            student: {
              userId: session.user.id,
            },
          },
        },
      });

      if (!lesson) {
        state.message = '존재하지 않는 세션입니다.';
        return state;
      }

      const lessonAt = parseDateTime(data.lessonAt as string).toDate('Asia/Seoul');
      const isDone = data.isDone === 'on';

      await prisma.lesson.update({
        where: {
          id: Number(sessionId),
          syllabus: {
            student: {
              userId: session.user.id,
            },
          },
        },
        data: {
          notes: data.notes as string,
          lessonAt,
          isDone,
          updatedAt: new Date(),
        },
      });

      revalidatePath('/sessions', 'page');
      revalidatePath('/lessons', 'page');
      state.success = true;
      state.message = '세션 정보를 수정하였습니다';
      return state;
    },
  );
}

type RemoveSessionState = {
  success: boolean;
  message?: string;
  timestamp: number;
};

export async function removeSession(prevState: RemoveSessionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeSession',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: RemoveSessionState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.user) {
        return state;
      }

      const sessionId = Number(formData.get('sessionId'));

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: sessionId,
          deletedAt: null,
          syllabus: {
            deletedAt: null,
            student: {
              userId: session.user.id,
            },
          },
        },
      });

      if (!lesson) {
        return state;
      }

      await prisma.lesson.update({
        where: {
          id: lesson.id,
          syllabus: {
            deletedAt: null,
            student: {
              userId: session.user.id,
            },
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });

      revalidatePath('/sessions', 'page');
      revalidatePath('/lessons', 'page');

      state.success = true;
      state.message = '수업을 삭제하였습니다.';
      return state;
    },
  );
}
