import { z } from 'zod';

export const presignedUrlSchema = z.object({
  fileName: z.string().min(1, '파일 이름이 필요합니다.'),
  contentType: z.string().min(1, '콘텐츠 타입이 필요합니다.'),
  fileSize: z.number().int().positive('파일 크기는 양수여야 합니다.'),
});

export const createFileSchema = z.object({
  url: z.string().url('올바른 URL 형식이 아닙니다.'),
  publicId: z.string().min(1, 'Public ID가 필요합니다.'),
  type: z.enum(['image', 'video', 'document'], {
    errorMap: () => ({ message: '지원하지 않는 파일 타입입니다.' }),
  }),
  contentType: z.string().min(1, '콘텐츠 타입이 필요합니다.'),
  fileName: z.string().min(1, '파일 이름이 필요합니다.'),
  fileSize: z.number().int().positive('파일 크기는 양수여야 합니다.'),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
export type CreateFileInput = z.infer<typeof createFileSchema>;
