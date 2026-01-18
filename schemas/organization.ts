import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, { error: '상호명을 입력해주세요' }),
  phone: z.string().optional(),
  address: z.string().optional(),
});
