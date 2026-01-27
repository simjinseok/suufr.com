import { apiClient } from '../api-client';
import type { TMediaFile, TStorageQuota, TFolder, TFolderBreadcrumb } from '@/types/index';

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
  type: 'image' | 'video' | 'document';
  contentType: string;
  fileName: string;
  fileSize: number;
  folderUuid?: string;
};

type MediaFileResponse = {
  success: boolean;
  data: TMediaFile;
};

type FoldersResponse = {
  success: boolean;
  data: TFolder[];
};

type FolderResponse = {
  success: boolean;
  data: TFolder;
};

type FolderBreadcrumbResponse = {
  success: boolean;
  data: TFolderBreadcrumb[];
};

type DeleteFolderResponse = {
  success: boolean;
  data: {
    deletedFolders: number;
    deletedFiles: number;
    freedBytes: number;
  };
};

export const storageApi = {
  // 스토리지 용량
  getQuota: () =>
    apiClient<StorageQuotaResponse>('/api/storage/quota'),

  // 파일 목록 조회
  listFiles: (params?: { folderId?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.folderId) searchParams.set('folderId', params.folderId);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return apiClient<MediaFilesResponse>(`/api/storage/files${query ? `?${query}` : ''}`);
  },

  // 파일 생성
  createFile: (data: CreateMediaFileData) =>
    apiClient<MediaFileResponse>('/api/storage/files', {
      method: 'POST',
      body: data,
    }),

  // 파일 삭제
  deleteFile: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/storage/files/${uuid}`, { method: 'DELETE' }),

  // 파일 이동
  moveFile: (uuid: string, folderUuid: string | null) =>
    apiClient<MediaFileResponse>(`/api/storage/files/${uuid}/move`, {
      method: 'PATCH',
      body: { folderUuid },
    }),

  // 파일 이름 변경
  renameFile: (uuid: string, fileName: string) =>
    apiClient<MediaFileResponse>(`/api/storage/files/${uuid}`, {
      method: 'PATCH',
      body: { fileName },
    }),

  // 폴더 목록 조회 (트리 구조)
  listFolders: () =>
    apiClient<FoldersResponse>('/api/storage/folders'),

  // 단일 폴더 조회
  getFolder: (uuid: string) =>
    apiClient<FolderResponse>(`/api/storage/folders/${uuid}`),

  // 폴더 breadcrumb 조회
  getFolderBreadcrumb: (uuid: string) =>
    apiClient<FolderBreadcrumbResponse>(`/api/storage/folders/${uuid}/breadcrumb`),

  // 폴더 생성
  createFolder: (data: { name: string; parentUuid?: string }) =>
    apiClient<FolderResponse>('/api/storage/folders', {
      method: 'POST',
      body: data,
    }),

  // 폴더 수정
  updateFolder: (uuid: string, data: { name: string }) =>
    apiClient<FolderResponse>(`/api/storage/folders/${uuid}`, {
      method: 'PATCH',
      body: data,
    }),

  // 폴더 삭제
  deleteFolder: (uuid: string) =>
    apiClient<DeleteFolderResponse>(`/api/storage/folders/${uuid}`, { method: 'DELETE' }),
};
