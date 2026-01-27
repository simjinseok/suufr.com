'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/utils/auth';
import { storageApi } from '@/utils/api/storage';
import type { TMediaFile, TStorageQuota, TFolder, TFolderBreadcrumb } from '@/types/index';

// 폴더명 유효성 검사 스키마
const folderNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '폴더명을 입력해주세요.')
    .max(50, '폴더명은 50자를 초과할 수 없습니다.')
    .regex(/^[가-힣a-zA-Z0-9\s\-_\(\)\[\]]+$/, '폴더명에 허용되지 않는 특수문자가 포함되어 있습니다.'),
  parentUuid: z.string().optional(),
  uuid: z.string().optional(),
});

// 파일명 유효성 검사 스키마
const fileNameSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, '파일명을 입력해주세요.')
    .max(100, '파일명은 100자를 초과할 수 없습니다.')
    .regex(/^[^/\\:*?"<>|]+$/, '파일명에 사용할 수 없는 문자가 포함되어 있습니다.'),
  uuid: z.string(),
});

export async function getStorageQuota(): Promise<TStorageQuota | null> {
  return await Sentry.withServerActionInstrumentation(
    'getStorageQuota',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return null;
      }

      try {
        const result = await storageApi.getQuota();
        return result.data;
      }
      catch (error) {
        console.error('Failed to get storage quota:', error);
        return null;
      }
    },
  );
}

export async function getMyMediaFiles(params?: { folderId?: string; search?: string }): Promise<TMediaFile[]> {
  return await Sentry.withServerActionInstrumentation(
    'getMyMediaFiles',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return [];
      }

      try {
        const result = await storageApi.listFiles(params);
        return result.data;
      }
      catch (error) {
        console.error('Failed to get media files:', error);
        return [];
      }
    },
  );
}

export type CreateMediaFileData = {
  url: string;
  publicId: string;
  type: 'image' | 'video' | 'document';
  contentType: string;
  fileName: string;
  fileSize: number;
  folderUuid?: string;
};

export type CreateMediaFileResult = {
  success: boolean;
  data?: TMediaFile;
  message?: string;
};

export async function createMediaFile(data: CreateMediaFileData): Promise<CreateMediaFileResult> {
  return await Sentry.withServerActionInstrumentation(
    'createMediaFile',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return { success: false, message: '인증이 필요합니다.' };
      }

      try {
        console.log('data', JSON.stringify(data))
        const result = await storageApi.createFile(data);
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/settings/files');
        return { success: true, data: result.data };
      }
      catch (error) {
        console.error('Failed to create media file:', error);
        if (error instanceof Error && error.message.includes('용량')) {
          return { success: false, message: '스토리지 용량이 부족합니다.' };
        }
        return { success: false, message: '파일 저장에 실패했습니다.' };
      }
    },
  );
}

export type DeleteMediaFileResult = {
  success: boolean;
  message?: string;
};

export async function deleteMediaFile(uuid: string): Promise<DeleteMediaFileResult> {
  return await Sentry.withServerActionInstrumentation(
    'deleteMediaFile',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return { success: false, message: '인증이 필요합니다.' };
      }

      try {
        await storageApi.deleteFile(uuid);
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/settings/files');
        return { success: true };
      }
      catch (error) {
        console.error('Failed to delete media file:', error);
        if (error instanceof Error && error.message.includes('사용 중')) {
          return { success: false, message: '다른 곳에서 사용 중인 파일은 삭제할 수 없습니다.' };
        }
        return { success: false, message: '파일 삭제에 실패했습니다.' };
      }
    },
  );
}

export type RenameFileState = {
  success?: boolean;
  fields: { uuid: string; fileName: string };
  errors?: Record<string, string[]>;
};

export async function renameFileAction(prevState: RenameFileState, formData: FormData): Promise<RenameFileState> {
  return await Sentry.withServerActionInstrumentation(
    'renameFile',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: RenameFileState = {
        success: false,
        fields: { uuid: data.uuid as string, fileName: data.fileName as string },
        errors: {},
      };

      const session = await getSession();
      if (!session?.organization) {
        state.errors = { fileName: ['인증이 필요합니다.'] };
        return state;
      }

      const validationResult = fileNameSchema.safeParse(data);
      if (!validationResult.success) {
        state.errors = validationResult.error.flatten().fieldErrors as Record<string, string[]>;
        return state;
      }

      try {
        await storageApi.renameFile(data.uuid as string, validationResult.data.fileName);
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/settings/files');
        state.success = true;
        return state;
      }
      catch (error) {
        console.error('Failed to rename file:', error);
        state.errors = { fileName: [error instanceof Error ? error.message : '파일 이름 변경에 실패했습니다.'] };
        return state;
      }
    },
  );
}

// ==================== 폴더 관련 ====================

export async function getMyFolders(): Promise<TFolder[]> {
  return await Sentry.withServerActionInstrumentation(
    'getMyFolders',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return [];
      }

      try {
        const result = await storageApi.listFolders();
        return result.data;
      }
      catch (error) {
        console.error('Failed to get folders:', error);
        return [];
      }
    },
  );
}

export async function getFolderBreadcrumb(uuid: string): Promise<TFolderBreadcrumb[]> {
  return await Sentry.withServerActionInstrumentation(
    'getFolderBreadcrumb',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return [];
      }

      try {
        const result = await storageApi.getFolderBreadcrumb(uuid);
        return result.data;
      }
      catch (error) {
        console.error('Failed to get folder breadcrumb:', error);
        return [];
      }
    },
  );
}

export type CreateFolderState = {
  success?: boolean;
  fields: { name: string; parentUuid?: string };
  errors?: Record<string, string[]>;
};

export async function createFolderAction(prevState: CreateFolderState, formData: FormData): Promise<CreateFolderState> {
  return await Sentry.withServerActionInstrumentation(
    'createFolder',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: CreateFolderState = {
        success: false,
        fields: { name: data.name as string, parentUuid: data.parentUuid as string | undefined },
        errors: {},
      };

      const session = await getSession();
      if (!session?.organization) {
        state.errors = { name: ['인증이 필요합니다.'] };
        return state;
      }

      const validationResult = folderNameSchema.safeParse(data);
      if (!validationResult.success) {
        state.errors = validationResult.error.flatten().fieldErrors as Record<string, string[]>;
        return state;
      }

      try {
        await storageApi.createFolder({
          name: validationResult.data.name,
          parentUuid: validationResult.data.parentUuid,
        });
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/settings/files');
        state.success = true;
        return state;
      }
      catch (error) {
        console.error('Failed to create folder:', error);
        state.errors = { name: [error instanceof Error ? error.message : '폴더 생성에 실패했습니다.'] };
        return state;
      }
    },
  );
}

export type UpdateFolderState = {
  success?: boolean;
  fields: { uuid: string; name: string };
  errors?: Record<string, string[]>;
};

export async function updateFolderAction(prevState: UpdateFolderState, formData: FormData): Promise<UpdateFolderState> {
  return await Sentry.withServerActionInstrumentation(
    'updateFolder',
    { formData, headers: await headers(), recordResponse: true },
    async () => {
      const data = Object.fromEntries(formData);
      const state: UpdateFolderState = {
        success: false,
        fields: { uuid: data.uuid as string, name: data.name as string },
        errors: {},
      };

      const session = await getSession();
      if (!session?.organization) {
        state.errors = { name: ['인증이 필요합니다.'] };
        return state;
      }

      const validationResult = folderNameSchema.safeParse(data);
      if (!validationResult.success) {
        state.errors = validationResult.error.flatten().fieldErrors as Record<string, string[]>;
        return state;
      }

      try {
        await storageApi.updateFolder(data.uuid as string, { name: validationResult.data.name });
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/settings/files');
        state.success = true;
        return state;
      }
      catch (error) {
        console.error('Failed to update folder:', error);
        state.errors = { name: [error instanceof Error ? error.message : '폴더 수정에 실패했습니다.'] };
        return state;
      }
    },
  );
}

export type DeleteFolderResult = {
  success: boolean;
  data?: { deletedFolders: number; deletedFiles: number; freedBytes: number };
  message?: string;
};

export async function deleteFolder(uuid: string): Promise<DeleteFolderResult> {
  return await Sentry.withServerActionInstrumentation(
    'deleteFolder',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return { success: false, message: '인증이 필요합니다.' };
      }

      try {
        const result = await storageApi.deleteFolder(uuid);
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/settings/files');
        return { success: true, data: result.data };
      }
      catch (error) {
        console.error('Failed to delete folder:', error);
        if (error instanceof Error) {
          return { success: false, message: error.message };
        }
        return { success: false, message: '폴더 삭제에 실패했습니다.' };
      }
    },
  );
}

export type MoveFileResult = {
  success: boolean;
  data?: TMediaFile;
  message?: string;
};

export async function moveFileToFolder(fileUuid: string, folderUuid: string | null): Promise<MoveFileResult> {
  return await Sentry.withServerActionInstrumentation(
    'moveFileToFolder',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return { success: false, message: '인증이 필요합니다.' };
      }

      try {
        const result = await storageApi.moveFile(fileUuid, folderUuid);
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/settings/files');
        return { success: true, data: result.data };
      }
      catch (error) {
        console.error('Failed to move file:', error);
        if (error instanceof Error) {
          return { success: false, message: error.message };
        }
        return { success: false, message: '파일 이동에 실패했습니다.' };
      }
    },
  );
}
