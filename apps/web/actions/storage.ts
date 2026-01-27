'use server';

import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { getSession } from '@/utils/auth';
import { storageApi } from '@/utils/api/storage';
import type { TMediaFile, TStorageQuota } from '@/types/index';

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

export async function getMyMediaFiles(): Promise<TMediaFile[]> {
  return await Sentry.withServerActionInstrumentation(
    'getMyMediaFiles',
    { headers: await headers(), recordResponse: true },
    async () => {
      const session = await getSession();
      if (!session?.organization) {
        return [];
      }

      try {
        const result = await storageApi.listFiles();
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
