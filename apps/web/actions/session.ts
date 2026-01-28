'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';
import { z } from 'zod';
import { sessionsApi } from '@/utils/api';

type CreateSessionState = {
  success: boolean;
  fields?: {
    isDone: boolean;
    sessionAt: string;
    duration: number;
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
      const { lessonUuid, ...data } = Object.fromEntries(formData.entries());
      const state: CreateSessionState = {
        success: false,
        fields: {
          isDone: data.isDone === 'on',
          sessionAt: data.sessionAt as string,
          duration: Number(data.duration) || 60,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      await sessionsApi.create({
        lessonUuid: lessonUuid as string,
        sessionAt: parseDateTime(data.sessionAt as string).toDate('Asia/Seoul').toISOString(),
        duration: Number(data.duration) || 60,
        notes: data.notes as string,
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
  duration: number;
  notes: string;
}>;
const updateSessionSchema = z.object({
  isDone: z.preprocess(val => val === 'on', z.boolean()),
  sessionAt: z.string().transform(val => parseDateTime(val).toDate('Asia/Seoul').toISOString()),
  duration: z.coerce.number().int().min(1).default(60),
  notes: z.string().trim(),
});
export async function updateSession(prevState: UpdateSessionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateSession',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { sessionUuid, ...data } = Object.fromEntries(formData.entries());

      const currentDate = new Date();
      const state: UpdateSessionState = {
        success: false,
        fields: {
          isDone: data.isDone === 'on',
          sessionAt: data.sessionAt as string,
          duration: Number(data.duration) || 60,
          notes: data.notes as string,
        },
        timestamp: currentDate.getTime(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const validationResult = updateSessionSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const { isDone, sessionAt, duration, notes } = validationResult.data;

      // 세션 미디어 파일 데이터 파싱
      const addMediaFileUuidsStr = formData.get('addMediaFileUuids') as string;
      const removeMediaFileUuidsStr = formData.get('removeMediaFileUuids') as string;

      const addMediaFileUuids = addMediaFileUuidsStr ? JSON.parse(addMediaFileUuidsStr) : undefined;
      const removeMediaFileUuids = removeMediaFileUuidsStr ? JSON.parse(removeMediaFileUuidsStr) : undefined;

      await sessionsApi.update(sessionUuid as string, {
        isDone,
        sessionAt,
        duration,
        notes,
        addMediaFileUuids,
        removeMediaFileUuids,
      });

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
      if (!session?.organization) {
        return state;
      }

      const sessionUuid = formData.get('sessionUuid') as string;

      await sessionsApi.remove(sessionUuid);

      revalidatePath('/(authenticated)/students/[studentUuid]/@lessons', 'page');
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
      if (!session?.organization) {
        return state;
      }

      const sessionUuid = formData.get('sessionUuid') as string;
      const notes = formData.get('notes') as string;
      const shouldDelete = formData.get('delete') === 'true';

      if (shouldDelete) {
        await sessionsApi.deleteFeedback(sessionUuid);
        state.success = true;
        state.message = '피드백을 삭제하였습니다.';
      } else {
        await sessionsApi.upsertFeedback(sessionUuid, { notes });
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

type SessionDetailData = {
  current: {
    id: number;
    uuid: string;
    sessionAt: string;
    isDone: boolean;
    notes: string;
    feedback: string | null;
    lessonTitle: string;
    studentName: string;
    studentUuid: string;
  };
  previousSessions: {
    id: number;
    uuid: string;
    sessionAt: string;
    isDone: boolean;
    notes: string;
    feedback: string | null;
  }[];
};

export async function toggleSessionDone(sessionUuid: string, isDone: boolean): Promise<boolean> {
  const session = await getSession();
  if (!session?.organization) {
    return false;
  }

  await sessionsApi.markDone(sessionUuid, isDone);

  revalidatePath('/sessions', 'page');
  revalidatePath('/lessons', 'page');
  revalidatePath('/students', 'page');

  return true;
}

export async function addSessionFiles(sessionUuid: string, mediaFileUuids: string[]): Promise<boolean> {
  const session = await getSession();
  if (!session?.organization) {
    return false;
  }

  await sessionsApi.update(sessionUuid, {
    addMediaFileUuids: mediaFileUuids,
  });

  revalidatePath('/sessions', 'page');
  revalidatePath('/lessons', 'page');
  revalidatePath('/students', 'page');

  return true;
}

export async function updateSessionFiles(
  sessionUuid: string,
  addMediaFileUuids: string[],
  removeMediaFileUuids: string[],
): Promise<boolean> {
  const session = await getSession();
  if (!session?.organization) {
    return false;
  }

  await sessionsApi.update(sessionUuid, {
    addMediaFileUuids: addMediaFileUuids.length > 0 ? addMediaFileUuids : undefined,
    removeMediaFileUuids: removeMediaFileUuids.length > 0 ? removeMediaFileUuids : undefined,
  });

  revalidatePath('/sessions', 'page');
  revalidatePath('/lessons', 'page');
  revalidatePath('/students', 'page');

  return true;
}

export async function getSessionDetail(sessionUuid: string): Promise<SessionDetailData | null> {
  const session = await getSession();
  if (!session?.organization) {
    return null;
  }

  const { data: currentSession } = await sessionsApi.get(sessionUuid);

  if (!currentSession) {
    return null;
  }

  // Get previous sessions for the same student (before current session date)
  const { data: previousSessions } = await sessionsApi.list({
    organizationUuids: [session.organization.uuid],
    dateTo: currentSession.sessionAt,
    limit: 4, // Get 4 to filter out current session
  });

  // Filter out the current session and sessions from other students, take only 3
  const filteredPrevious = previousSessions
    .filter(s => s.uuid !== sessionUuid && s.lesson.student.uuid === currentSession.lesson.student.uuid)
    .slice(0, 3);

  return {
    current: {
      id: currentSession.id,
      uuid: currentSession.uuid,
      sessionAt: currentSession.sessionAt,
      isDone: currentSession.isDone,
      notes: currentSession.notes,
      feedback: currentSession.feedback?.notes || null,
      lessonTitle: currentSession.lesson.title,
      studentName: currentSession.lesson.student.name,
      studentUuid: currentSession.lesson.student.uuid,
    },
    previousSessions: filteredPrevious.map(s => ({
      id: s.id,
      uuid: s.uuid,
      sessionAt: s.sessionAt,
      isDone: s.isDone,
      notes: s.notes,
      feedback: s.feedback?.notes || null,
    })),
  };
}
