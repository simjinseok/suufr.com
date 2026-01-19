import { z } from 'zod';

export const memberStatusValues = ['active', 'paused', 'leave'] as const;

export const createMemberStatusSchema = z.object({
  status: z.enum(memberStatusValues, { error: '상태를 선택해주세요' }),
  notes: z.string().optional(),
});

export const updateMemberStatusSchema = z.object({
  notes: z.string().optional(),
});
