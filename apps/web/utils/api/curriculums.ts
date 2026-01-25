import { apiClient } from '../api-client';
import type { TCurriculum, TCurriculumItem, TTempMediaFile } from '@/types/index';

type CurriculumResponse = {
  success: boolean;
  data: TCurriculum;
};

type CurriculumsResponse = {
  success: boolean;
  data: TCurriculum[];
};

type ListCurriculumsParams = {
  search?: string;
};

type CurriculumItemResponse = {
  success: boolean;
  data: TCurriculumItem;
};

type CreateCurriculumData = {
  title: string;
  description?: string;
};

type UpdateCurriculumData = {
  title?: string;
  description?: string;
};

type CreateCurriculumItemData = {
  curriculumUuid: string;
  title: string;
  description?: string;
  newMediaFiles?: TTempMediaFile[];
  existingMediaFileUuids?: string[];
};

type UpdateCurriculumItemData = {
  title?: string;
  description?: string;
  addNewMediaFiles?: TTempMediaFile[];
  addExistingMediaFileUuids?: string[];
  removeMediaFileUuids?: string[];
};

export const curriculumsApi = {
  list: (params?: ListCurriculumsParams) =>
    apiClient<CurriculumsResponse>('/api/curriculums', { params }),

  get: (uuid: string) =>
    apiClient<CurriculumResponse>(`/api/curriculums/${uuid}`),

  create: (data: CreateCurriculumData) =>
    apiClient<CurriculumResponse>('/api/curriculums', { method: 'POST', body: data }),

  update: (uuid: string, data: UpdateCurriculumData) =>
    apiClient<CurriculumResponse>(`/api/curriculums/${uuid}`, { method: 'PATCH', body: data }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/curriculums/${uuid}`, { method: 'DELETE' }),

  // Items
  createItem: (data: CreateCurriculumItemData) =>
    apiClient<CurriculumItemResponse>('/api/curriculums/items', { method: 'POST', body: data }),

  getItem: (uuid: string) =>
    apiClient<CurriculumItemResponse>(`/api/curriculums/items/${uuid}`),

  updateItem: (uuid: string, data: UpdateCurriculumItemData) =>
    apiClient<CurriculumItemResponse>(`/api/curriculums/items/${uuid}`, { method: 'PATCH', body: data }),

  removeItem: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/curriculums/items/${uuid}`, { method: 'DELETE' }),
};
