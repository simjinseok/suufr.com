'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import prisma from '@/utils/prisma';
import { ServerActionState } from '@/types/index';
import { z } from 'zod';

type CreateSessionState = {
  success: boolean;
  fields?: {
    isDone: boolean;
    sessionAt: string;
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
          sessionAt: data.sessionAt as string,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.user) {
        return state;
      }

      const lesson = await prisma.lesson.findUnique({
        where: {
          id: Number(lessonId),
          deletedAt: null,
          student: {
            userId: session.user.id,
          },
        },
      });

      if (!lesson) {
        return state;
      }

      await prisma.session.create({
        data: {
          lessonId: Number(lessonId),
          isDone: data.isDone === 'on',
          notes: data.notes as string,
          sessionAt: parseDateTime(data.sessionAt as string).toDate('Asia/Seoul'),
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

type UpdateSessionState = ServerActionState<{
  isDone: boolean;
  sessionAt: string;
  notes: string;
  feedback: string;
}>;
const updateSessionSchema = z.object({
  isDone: z.preprocess(val => val === 'on', z.boolean()),
  sessionAt: z.string().transform(val => parseDateTime(val).toDate('Asia/Seoul')),
  notes: z.string().trim(),
  feedback: z.string().trim(),
}).transform(data => ({
  ...data,
  feedback: data.isDone ? data.feedback : '',
}));
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

      const currentDate = new Date();
      const state: UpdateSessionState = {
        success: false,
        fields: {
          isDone: data.isDone === 'on',
          sessionAt: data.sessionAt as string,
          notes: data.notes as string,
          feedback: data.feedback as string,
        },
        timestamp: currentDate.getTime(),
      };

      const session = await getSession();
      if (!session?.user) {
        return state;
      }

      const validationResult = updateSessionSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const { isDone, sessionAt, notes, feedback } = validationResult.data;

      const lesson = await prisma.session.findUnique({
        where: {
          id: Number(sessionId),
          deletedAt: null,
          lesson: {
            deletedAt: null,
            student: {
              userId: session.user.id,
              deletedAt: null,
            },
          },
        },
      });

      if (!lesson) {
        state.message = '존재하지 않는 세션입니다.';
        return state;
      }

      await prisma.session.update({
        where: {
          id: Number(sessionId),
          lesson: {
            student: {
              userId: session.user.id,
            },
          },
        },
        data: {
          notes,
          sessionAt,
          isDone,
          updatedAt: currentDate,
        },
      });

      // feedback 처리: isDone이고 내용이 있으면 upsert, 아니면 소프트 삭제
      if (isDone && feedback) {
        await prisma.feedback.upsert({
          where: { sessionId: lesson.id },
          create: { sessionId: lesson.id, notes: feedback },
          update: { notes: feedback, deletedAt: null, updatedAt: currentDate },
        });
      }
      else {
        await prisma.feedback.updateMany({
          where: { sessionId: lesson.id, deletedAt: null },
          data: { deletedAt: currentDate },
        });
      }

      revalidatePath('/sessions', 'page');
      revalidatePath('/lessons', 'page');
      revalidatePath('/students', 'page');
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

      const lesson = await prisma.session.findUnique({
        where: {
          id: sessionId,
          deletedAt: null,
          lesson: {
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

      await prisma.session.update({
        where: {
          id: lesson.id,
          lesson: {
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

type UpdateFeedbackState = {
  success: boolean;
  message?: string;
  timestamp: number;
};

export async function updateFeedback(prevState: UpdateFeedbackState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateFeedback',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: UpdateFeedbackState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.user) {
        return state;
      }

      const sessionId = Number(formData.get('sessionId'));
      const notes = formData.get('notes') as string;
      const shouldDelete = formData.get('delete') === 'true';

      const sessionRecord = await prisma.session.findUnique({
        where: {
          id: sessionId,
          deletedAt: null,
          lesson: {
            deletedAt: null,
            student: {
              userId: session.user.id,
            },
          },
        },
        include: {
          feedback: true,
        },
      });

      if (!sessionRecord) {
        state.message = '존재하지 않는 수업입니다.';
        return state;
      }

      if (!sessionRecord.isDone) {
        state.message = '완료된 수업만 피드백을 작성할 수 있습니다.';
        return state;
      }

      if (shouldDelete) {
        if (sessionRecord.feedback) {
          await prisma.feedback.delete({
            where: { id: sessionRecord.feedback.id },
          });
        }
        state.success = true;
        state.message = '피드백을 삭제하였습니다.';
      }
      else {
        await prisma.feedback.upsert({
          where: { sessionId },
          create: { sessionId, notes },
          update: { notes, updatedAt: new Date() },
        });
        state.success = true;
        state.message = '피드백을 저장하였습니다.';
      }

      revalidatePath('/sessions', 'page');
      revalidatePath('/lessons', 'page');
      revalidatePath('/students', 'page');

      return state;
    },
  );
}
