import { apiClient } from '../api-client';

type StudentComment = {
  id: number;
  uuid: string;
  content: string;
  createdAt: string;
  studentId: number;
};

type ListCommentsResponse = {
  success: boolean;
  data: StudentComment[];
};

type CommentResponse = {
  success: boolean;
  data: StudentComment;
};

type CreateCommentData = {
  content: string;
};

type UpdateCommentData = {
  content?: string;
};

export const studentCommentsApi = {
  listByStudent: (studentUuid: string) =>
    apiClient<ListCommentsResponse>(`/api/students/${studentUuid}/comments`),

  create: (studentUuid: string, data: CreateCommentData) =>
    apiClient<CommentResponse>(`/api/students/${studentUuid}/comments`, {
      method: 'POST',
      body: data,
    }),

  update: (uuid: string, data: UpdateCommentData) =>
    apiClient<CommentResponse>(`/api/student-comments/${uuid}`, {
      method: 'PATCH',
      body: data,
    }),

  remove: (uuid: string) =>
    apiClient<{ success: boolean }>(`/api/student-comments/${uuid}`, {
      method: 'DELETE',
    }),
};
