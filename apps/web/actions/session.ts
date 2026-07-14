'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import { getUserSettings } from '@/utils/user-settings';
import { DEFAULT_TIMEZONE } from '@/utils/timezone';
import { ServerActionState } from '@/types/index';
import { z } from 'zod';
import { sessionsApi } from '@/utils/api';
import { ApiError } from '@/utils/api-client';

// 폼의 벽시계 문자열("YYYY-MM-DDTHH:mm")을 instant로 바꿀 기준 = 유저 설정 타임존
async function getUserTimeZone(): Promise<string> {
  const settings = await getUserSettings();
  return settings.timezone ?? DEFAULT_TIMEZONE;
}

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
      const { studentUuid, invoiceUuid, ...data } = Object.fromEntries(formData.entries());
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

      const timeZone = await getUserTimeZone();
      await sessionsApi.create({
        studentUuid: studentUuid as string,
        invoiceUuid: (invoiceUuid as string) || undefined,
        sessionAt: parseDateTime(data.sessionAt as string).toDate(timeZone).toISOString(),
        duration: Number(data.duration) || 60,
        notes: data.notes as string,
      });

      revalidatePath('/sessions', 'page');
      revalidatePath('/students', 'page');

      state.success = true;
      return state;
    },
  );
}

// 요일·시간·횟수로 계산한 수업 목록을 한 번에 생성 (수강권 카드의 "수업 만들기")
type CreateSessionsBulkState = ServerActionState<null>;
export async function createSessionsBulk(prevState: CreateSessionsBulkState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createSessionsBulk',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: CreateSessionsBulkState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      // 클라이언트 미리보기에 표시된 그대로의 목록 ("YYYY-MM-DDTHH:mm", 유저 설정 타임존 벽시계)
      let sessionAts: unknown;
      try {
        sessionAts = JSON.parse((formData.get('sessions') as string) || '[]');
      }
      catch {
        sessionAts = null;
      }

      const validationResult = z.array(z.string()).min(1).max(50).safeParse(sessionAts);
      if (!validationResult.success) {
        state.message = '생성할 수업이 없습니다';
        return state;
      }

      const duration = Number(formData.get('duration')) || 60;
      const timeZone = await getUserTimeZone();

      try {
        const { data } = await sessionsApi.createBulk({
          studentUuid: formData.get('studentUuid') as string,
          invoiceUuid: (formData.get('invoiceUuid') as string) || undefined,
          sessions: validationResult.data.map(sessionAt => ({
            sessionAt: parseDateTime(sessionAt).toDate(timeZone).toISOString(),
            duration,
          })),
          nextPaymentAt: (formData.get('nextPaymentAt') as string) || undefined,
        });
        state.message = `수업 ${data.length}개를 만들었습니다`;
      }
      catch (error) {
        state.message = error instanceof ApiError ? error.message : '수업 생성에 실패했습니다';
        return state;
      }

      revalidatePath('/students', 'layout');
      revalidatePath('/sessions', 'page');
      revalidatePath('/calendar', 'page');

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
const updateSessionSchema = (timeZone: string) => z.object({
  isDone: z.preprocess(val => val === 'on', z.boolean()),
  sessionAt: z.string().transform(val => parseDateTime(val).toDate(timeZone).toISOString()),
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

      const validationResult = updateSessionSchema(await getUserTimeZone()).safeParse(data);
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

      revalidatePath('/students', 'layout');

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
      }
      else {
        await sessionsApi.upsertFeedback(sessionUuid, { notes });
        state.success = true;
        state.message = '피드백을 저장하였습니다.';
      }

      revalidatePath('/sessions', 'page');
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
    invoiceTitle: string | null;
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
  return await Sentry.withServerActionInstrumentation(
    'toggleSessionDone',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return false;
      }

      await sessionsApi.markDone(sessionUuid, isDone);

      revalidatePath('/sessions', 'page');
      revalidatePath('/students', 'page');

      return true;
    },
  );
}

export async function addSessionFiles(sessionUuid: string, mediaFileUuids: string[]): Promise<boolean> {
  return await Sentry.withServerActionInstrumentation(
    'addSessionFiles',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return false;
      }

      await sessionsApi.update(sessionUuid, {
        addMediaFileUuids: mediaFileUuids,
      });

      revalidatePath('/sessions', 'page');
      revalidatePath('/students', 'page');

      return true;
    },
  );
}

export async function updateSessionFiles(
  sessionUuid: string,
  addMediaFileUuids: string[],
  removeMediaFileUuids: string[],
): Promise<boolean> {
  return await Sentry.withServerActionInstrumentation(
    'updateSessionFiles',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return false;
      }

      await sessionsApi.update(sessionUuid, {
        addMediaFileUuids: addMediaFileUuids.length > 0 ? addMediaFileUuids : undefined,
        removeMediaFileUuids: removeMediaFileUuids.length > 0 ? removeMediaFileUuids : undefined,
      });

      revalidatePath('/sessions', 'page');
      revalidatePath('/students', 'page');

      return true;
    },
  );
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
    .filter(s => s.uuid !== sessionUuid && s.student.uuid === currentSession.student.uuid)
    .slice(0, 3);

  return {
    current: {
      id: currentSession.id,
      uuid: currentSession.uuid,
      sessionAt: currentSession.sessionAt,
      isDone: currentSession.isDone,
      notes: currentSession.notes,
      feedback: currentSession.feedback?.notes || null,
      invoiceTitle: currentSession.invoice?.title ?? null,
      studentName: currentSession.student.name,
      studentUuid: currentSession.student.uuid,
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
