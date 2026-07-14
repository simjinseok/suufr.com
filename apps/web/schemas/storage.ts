import { z } from 'zod';

export const presignedUrlSchema = z.object({
  fileName: z.string().min(1, '파일 이름이 필요합니다.'),
  contentType: z.string().min(1, '콘텐츠 타입이 필요합니다.'),
  fileSize: z.number().int().positive('파일 크기는 양수여야 합니다.'),
  // 'profile': MediaFile 미등록 프로필성 이미지 (공개 prefix, 엔티티 저장 시 커밋)
  purpose: z.literal('profile').optional(),
});

// API가 forbidNonWhitelisted DTO로 검증하므로 서버가 재도출하는 필드(url/type/fileSize 등)는 보내지 않는다
export const createFileSchema = z.object({
  publicId: z.string().min(1, 'Public ID가 필요합니다.'),
  fileName: z.string().min(1, '파일 이름이 필요합니다.'),
  folderUuid: z.string().optional(),
});

export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
export type CreateFileInput = z.infer<typeof createFileSchema>;
