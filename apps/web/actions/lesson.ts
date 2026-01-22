'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { parseZonedDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';
import { getUserSettings } from './settings';
import { lessonsApi, studentsApi } from '@/utils/api';

type CreateLessonState = ServerActionState<null>;
export async function createLesson(prevState: CreateLessonState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createLesson',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();
      const { studentUuid } = Object.fromEntries(formData.entries());

      const state: CreateLessonState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }
      const { user } = session;

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

      // API로 lesson과 sessions 생성
      const sessions = lessonDates.map((dateString) => ({
        sessionAt: parseZonedDateTime(dateString).toDate().toISOString(),
        duration: lessonDuration,
        notes: '',
      }));

      await lessonsApi.create({
        title: (formData.get('title') as string) || '',
        notes: (formData.get('notes') as string) || '',
        studentUuid: studentUuid as string,
        sessions: sessions.length > 0 ? sessions : undefined,
      });

      // 다음결제예정일 업데이트 (설정에 따라)
      if (nextPaymentAtStr) {
        const settings = await getUserSettings(user.id);
        if (settings.autoUpdateNextPaymentAt) {
          await studentsApi.update(studentUuid as string, {
            nextPaymentAt: parseZonedDateTime(nextPaymentAtStr).toDate().toISOString(),
          });
        }
      }

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
      const { lessonUuid, ...data } = Object.fromEntries(formData.entries());

      const state: UpdateLessonState = {
        success: false,
        fields: {
          title: data.title as string,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };
      const session = await getSession();

      if (!session?.organization) {
        return state;
      }

      const validationResult = updateLessonSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await lessonsApi.update(lessonUuid as string, {
        title: validationResult.data.title,
        notes: validationResult.data.notes,
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
      const lessonUuid = formData.get('lessonUuid') as string;

      const state: RemoveLessonState = {
        success: false,
        timestamp: Date.now(),
      };
      const session = await getSession();

      if (!session?.organization) {
        return state;
      }

      // API로 삭제 요청 (API에서 활성 세션 체크는 하지 않으므로 여기서 체크 필요할 수 있음)
      // 현재 API는 그냥 soft delete 수행
      await lessonsApi.remove(lessonUuid);

      revalidatePath('/students/[studentId]/@lessons', 'page');
      state.success = true;
      state.message = '수업을 삭제하였습니다';
      return state;
    });
}

type CreateLessonShareState = {
  success: boolean;
  shareId?: string;
  expiresAt?: string;
  timestamp: number;
};
export async function createLessonShare(prevState: CreateLessonShareState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createLessonShare',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: CreateLessonShareState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const lessonUuid = formData.get('lessonUuid') as string;
      const result = await lessonsApi.createShare(lessonUuid);

      state.success = true;
      state.shareId = result.data.shareId;
      state.expiresAt = result.data.expiresAt;
      return state;
    },
  );
}

type DeleteLessonShareState = {
  success: boolean;
  timestamp: number;
};
export async function deleteLessonShare(prevState: DeleteLessonShareState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'deleteLessonShare',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: DeleteLessonShareState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const lessonUuid = formData.get('lessonUuid') as string;
      const shareId = formData.get('shareId') as string;
      await lessonsApi.deleteShare(lessonUuid, shareId);

      state.success = true;
      return state;
    },
  );
}
