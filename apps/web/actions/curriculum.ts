'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';
import { curriculumsApi } from '@/utils/api';

// Create Curriculum
type CreateCurriculumState = ServerActionState<{
  title: string;
  description: string;
}>;
const createCurriculumSchema = z.object({
  title: z.string().min(1, { error: '제목을 입력해주세요' }),
  description: z.string().optional(),
});

export async function createCurriculum(prevState: CreateCurriculumState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createCurriculum',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const data = Object.fromEntries(formData.entries());

      const state: CreateCurriculumState = {
        success: false,
        fields: {
          title: data.title as string,
          description: data.description as string,
        },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const validationResult = createCurriculumSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await curriculumsApi.create({
        title: validationResult.data.title,
        description: validationResult.data.description,
      });

      revalidatePath('/curriculums', 'page');
      state.success = true;
      state.message = '커리큘럼을 추가하였습니다';
      return state;
    },
  );
}

// Update Curriculum
type UpdateCurriculumState = ServerActionState<{
  title: string;
  description: string;
}>;
const updateCurriculumSchema = z.object({
  title: z.string().min(1, { error: '제목을 입력해주세요' }),
  description: z.string().optional(),
});

export async function updateCurriculum(prevState: UpdateCurriculumState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateCurriculum',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { curriculumUuid, ...data } = Object.fromEntries(formData.entries());

      const state: UpdateCurriculumState = {
        success: false,
        fields: {
          title: data.title as string,
          description: data.description as string,
        },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const validationResult = updateCurriculumSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await curriculumsApi.update(curriculumUuid as string, {
        title: validationResult.data.title,
        description: validationResult.data.description,
      });

      revalidatePath('/curriculums', 'page');
      state.success = true;
      state.message = '커리큘럼을 수정하였습니다';
      return state;
    },
  );
}

// Remove Curriculum
type RemoveCurriculumState = ServerActionState<null>;

export async function removeCurriculum(prevState: RemoveCurriculumState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeCurriculum',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const curriculumUuid = formData.get('curriculumUuid') as string;

      const state: RemoveCurriculumState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      await curriculumsApi.remove(curriculumUuid);

      revalidatePath('/curriculums', 'page');
      state.success = true;
      state.message = '커리큘럼을 삭제하였습니다';
      return state;
    },
  );
}

// Create Curriculum Item
type CreateCurriculumItemState = ServerActionState<{
  title: string;
  description: string;
}>;
const createCurriculumItemSchema = z.object({
  title: z.string().min(1, { error: '제목을 입력해주세요' }),
  description: z.string().optional(),
});

export async function createCurriculumItem(prevState: CreateCurriculumItemState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createCurriculumItem',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const data = Object.fromEntries(formData.entries());
      const curriculumUuid = data.curriculumUuid as string;

      const state: CreateCurriculumItemState = {
        success: false,
        fields: {
          title: data.title as string,
          description: data.description as string,
        },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const validationResult = createCurriculumItemSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      // Parse media file UUIDs from form data
      const mediaFileUuidsJson = data.mediaFileUuids as string;
      const mediaFileUuids: string[] = mediaFileUuidsJson ? JSON.parse(mediaFileUuidsJson) : [];

      await curriculumsApi.createItem({
        curriculumUuid,
        title: validationResult.data.title,
        description: validationResult.data.description,
        mediaFileUuids: mediaFileUuids.length > 0 ? mediaFileUuids : undefined,
      });

      revalidatePath('/curriculums', 'page');
      revalidatePath(`/curriculums/${curriculumUuid}`, 'page');
      state.success = true;
      state.message = '아이템을 추가하였습니다';
      return state;
    },
  );
}

// Update Curriculum Item
type UpdateCurriculumItemState = ServerActionState<{
  title: string;
  description: string;
}>;
const updateCurriculumItemSchema = z.object({
  title: z.string().min(1, { error: '제목을 입력해주세요' }),
  description: z.string().optional(),
});

export async function updateCurriculumItem(prevState: UpdateCurriculumItemState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateCurriculumItem',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const data = Object.fromEntries(formData.entries());
      const itemUuid = data.itemUuid as string;
      const curriculumUuid = data.curriculumUuid as string;

      const state: UpdateCurriculumItemState = {
        success: false,
        fields: {
          title: data.title as string,
          description: data.description as string,
        },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const validationResult = updateCurriculumItemSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      // Parse media file UUIDs from form data
      const addMediaFileUuidsJson = data.addMediaFileUuids as string;
      const removeMediaFileUuidsJson = data.removeMediaFileUuids as string;

      const addMediaFileUuids: string[] = addMediaFileUuidsJson ? JSON.parse(addMediaFileUuidsJson) : [];
      const removeMediaFileUuids: string[] = removeMediaFileUuidsJson ? JSON.parse(removeMediaFileUuidsJson) : [];

      await curriculumsApi.updateItem(itemUuid, {
        title: validationResult.data.title,
        description: validationResult.data.description,
        addMediaFileUuids: addMediaFileUuids.length > 0 ? addMediaFileUuids : undefined,
        removeMediaFileUuids: removeMediaFileUuids.length > 0 ? removeMediaFileUuids : undefined,
      });

      revalidatePath('/curriculums', 'page');
      revalidatePath(`/curriculums/${curriculumUuid}`, 'page');
      state.success = true;
      state.message = '아이템을 수정하였습니다';
      return state;
    },
  );
}

// Remove Curriculum Item
type RemoveCurriculumItemState = ServerActionState<null>;

export async function removeCurriculumItem(prevState: RemoveCurriculumItemState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeCurriculumItem',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const itemUuid = formData.get('itemUuid') as string;
      const curriculumUuid = formData.get('curriculumUuid') as string;

      const state: RemoveCurriculumItemState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      await curriculumsApi.removeItem(itemUuid);

      revalidatePath('/curriculums', 'page');
      revalidatePath(`/curriculums/${curriculumUuid}`, 'page');
      state.success = true;
      state.message = '아이템을 삭제하였습니다';
      return state;
    },
  );
}
