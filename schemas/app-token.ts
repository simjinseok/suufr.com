import { z } from 'zod';

export const createAppTokenSchema = z.object({
  name: z
    .string()
    .min(1, '토큰 이름을 입력해주세요')
    .max(50, '토큰 이름은 50자 이내로 입력해주세요'),
});

export type CreateAppTokenInput = z.infer<typeof createAppTokenSchema>;

export const revokeAppTokenSchema = z.object({
  tokenId: z.number().int().positive(),
});

export type RevokeAppTokenInput = z.infer<typeof revokeAppTokenSchema>;
