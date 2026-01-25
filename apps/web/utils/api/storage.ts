import { apiClient } from '../api-client';
import type { TMediaFile, TStorageQuota } from '@/types/index';

type StorageQuotaResponse = {
  success: boolean;
  data: TStorageQuota;
};

type MediaFilesResponse = {
  success: boolean;
  data: TMediaFile[];
};

type CreateMediaFileData = {
  url: string;
  publicId: string;
  type: 'image' | 'video';
  fileName: string;
  fileSize: number;
};

type MediaFileResponse = {
  success: boolean;
  data: TMediaFile;
};

export const storageApi = {
  getQuota: () =>
    apiClient<StorageQuotaResponse>('/api/storage/quota'),

  listFiles: () =>
    apiClient<MediaFilesResponse>('/api/storage/files'),

  createFile: (data: CreateMediaFileData) =>
    apiClient<MediaFileResponse>('/api/storage/files', {
      method: 'POST',
      body: data,
    }),

  deleteFile: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/storage/files/${uuid}`, { method: 'DELETE' }),
};
