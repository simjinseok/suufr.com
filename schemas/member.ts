import { z } from 'zod';

export const addMemberSchema = z.object({
  name: z.string().min(1, { error: '멤버 이름을 입력해주세요' }),
  profileImageKey: z.string().nullable().optional(),
});

export const updateMemberSchema = z.object({
  name: z.string().min(1, { error: '멤버 이름을 입력해주세요' }),
  profileImageKey: z.string().nullable().optional(),
});
