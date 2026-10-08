'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';
import { curriculumsApi } from '@/utils/api';

// 폼의 sectionUuid 값 → API 값. 'none'(SectionSelect 의 "섹션 없음")과 빈 값은 null.
function normalizeSectionUuid(raw: FormDataEntryValue | undefined): string | null {
  const value = typeof raw === 'string' ? raw : '';
  return value && value !== 'none' ? value : null;
}

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
        sectionUuid: normalizeSectionUuid(data.sectionUuid) ?? undefined,
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
        // 폼에 sectionUuid 필드가 있을 때만 소속을 보낸다. 'none' 은 섹션 없음(null)
        ...(data.sectionUuid !== undefined && { sectionUuid: normalizeSectionUuid(data.sectionUuid) }),
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

// Create Curriculum Section
type CurriculumSectionState = ServerActionState<{
  title: string;
  description: string;
}>;
const curriculumSectionSchema = z.object({
  title: z.string().min(1, { error: '제목을 입력해주세요' }),
  description: z.string().optional(),
});

export async function createCurriculumSection(prevState: CurriculumSectionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createCurriculumSection',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData.entries());
      const curriculumUuid = data.curriculumUuid as string;

      const state: CurriculumSectionState = {
        success: false,
        fields: { title: data.title as string, description: data.description as string },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) return state;

      const validationResult = curriculumSectionSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await curriculumsApi.createSection({
        curriculumUuid,
        title: validationResult.data.title,
        description: validationResult.data.description,
      });

      revalidatePath(`/curriculums/${curriculumUuid}`, 'page');
      state.success = true;
      state.message = '섹션을 추가하였습니다';
      return state;
    },
  );
}

// Update Curriculum Section
export async function updateCurriculumSection(prevState: CurriculumSectionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateCurriculumSection',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData.entries());
      const sectionUuid = data.sectionUuid as string;
      const curriculumUuid = data.curriculumUuid as string;

      const state: CurriculumSectionState = {
        success: false,
        fields: { title: data.title as string, description: data.description as string },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) return state;

      const validationResult = curriculumSectionSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await curriculumsApi.updateSection(sectionUuid, {
        title: validationResult.data.title,
        description: validationResult.data.description,
      });

      revalidatePath(`/curriculums/${curriculumUuid}`, 'page');
      state.success = true;
      state.message = '섹션을 수정하였습니다';
      return state;
    },
  );
}

// Remove Curriculum Section (항목은 섹션 없음으로 이동)
type RemoveCurriculumSectionState = ServerActionState<null>;

export async function removeCurriculumSection(prevState: RemoveCurriculumSectionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeCurriculumSection',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const sectionUuid = formData.get('sectionUuid') as string;
      const curriculumUuid = formData.get('curriculumUuid') as string;

      const state: RemoveCurriculumSectionState = { success: false, timestamp: Date.now() };

      const session = await getSession();
      if (!session?.organization) return state;

      await curriculumsApi.removeSection(sectionUuid);

      revalidatePath(`/curriculums/${curriculumUuid}`, 'page');
      state.success = true;
      state.message = '섹션을 삭제하였습니다';
      return state;
    },
  );
}

// Move (섹션·항목 공통 형식). Dropdown 메뉴에서 startTransition 으로 직접 호출한다.
type MoveInput = { uuid: string; curriculumUuid: string; direction: 'up' | 'down' };
type MoveResult = { success: boolean; message?: string };

export async function moveCurriculumSection(input: MoveInput): Promise<MoveResult> {
  const session = await getSession();
  if (!session?.organization) return { success: false };

  await curriculumsApi.moveSection(input.uuid, { direction: input.direction });
  revalidatePath(`/curriculums/${input.curriculumUuid}`, 'page');
  return { success: true };
}

export async function moveCurriculumItem(input: MoveInput): Promise<MoveResult> {
  const session = await getSession();
  if (!session?.organization) return { success: false };

  await curriculumsApi.moveItem(input.uuid, { direction: input.direction });
  revalidatePath(`/curriculums/${input.curriculumUuid}`, 'page');
  return { success: true };
}

// Move item to another section ("다른 섹션으로 이동" 모달)
type MoveItemToSectionState = ServerActionState<{ sectionUuid: string }>;

export async function moveCurriculumItemToSection(prevState: MoveItemToSectionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'moveCurriculumItemToSection',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const itemUuid = formData.get('itemUuid') as string;
      const curriculumUuid = formData.get('curriculumUuid') as string;
      const sectionUuid = normalizeSectionUuid(formData.get('sectionUuid') ?? undefined); // null = 섹션 없음

      const state: MoveItemToSectionState = {
        success: false,
        fields: { sectionUuid: sectionUuid ?? '' },
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) return state;

      await curriculumsApi.updateItem(itemUuid, { sectionUuid });

      revalidatePath(`/curriculums/${curriculumUuid}`, 'page');
      state.success = true;
      state.message = '항목을 이동하였습니다';
      return state;
    },
  );
}
