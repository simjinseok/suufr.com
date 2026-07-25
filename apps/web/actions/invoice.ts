'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';
import { invoicesApi } from '@/utils/api';

type CreateInvoiceState = ServerActionState<null>;
export async function createInvoice(prevState: CreateInvoiceState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createInvoice',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();
      const { studentUuid } = Object.fromEntries(formData.entries());

      const state: CreateInvoiceState = {
        success: false,
        timestamp: Date.now(),
      };

      if (!session?.organization) {
        return state;
      }

      const price = parseInt(formData.get('price') as string, 10) || 0;
      const periodStart = (formData.get('periodStart') as string) || undefined;
      const periodEnd = (formData.get('periodEnd') as string) || undefined;

      // 수강권은 기간·금액만 정한다. 수업은 캘린더에서 따로 만들고,
      // 기간이 겹치면 서버가 알아서 이 수강권에 귀속시킨다.
      // 입금도 여기서 다루지 않는다 — 수강권 카드의 입금 기록에서 별도로.
      await invoicesApi.create({
        studentUuid: studentUuid as string,
        title: (formData.get('title') as string) || undefined,
        price,
        periodStart,
        periodEnd,
        notes: (formData.get('notes') as string) || undefined,
      });

      revalidatePath('/students', 'layout');
      revalidatePath('/invoices', 'page');
      state.success = true;
      state.message = '수강권을 추가하였습니다';
      return state;
    });
}

// 회당 정산: 미연결 수업 1개를 1회 수강권(totalCount=1) + 입금으로 한 번에 기록
type SettleSessionState = ServerActionState<null>;
export async function settleSession(prevState: SettleSessionState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'settleSession',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const state: SettleSessionState = {
        success: false,
        timestamp: Date.now(),
      };

      const session = await getSession();
      if (!session?.organization) {
        return state;
      }

      const studentUuid = formData.get('studentUuid') as string;
      const sessionUuid = formData.get('sessionUuid') as string;
      const sessionDate = formData.get('sessionDate') as string; // yyyy-MM-dd (유저 설정 타임존 기준 달력 날짜)
      const price = parseInt(formData.get('price') as string, 10) || 0;
      const method = (formData.get('method') as string) || 'transfer';

      if (!sessionUuid || price <= 0) {
        state.message = '금액을 입력해주세요';
        return state;
      }

      await invoicesApi.create({
        studentUuid,
        title: (formData.get('title') as string) || undefined,
        price,
        totalCount: 1,
        periodStart: sessionDate,
        periodEnd: sessionDate,
        sessionUuids: [sessionUuid],
        initialPayment: { method, paidAt: new Date().toISOString() },
      });

      // 회당 정산은 수강권·입금·수업 귀속을 한 번에 바꾼다
      revalidatePath('/students', 'layout');
      revalidatePath('/invoices', 'page');
      revalidatePath('/payments', 'page');
      revalidatePath('/sessions', 'page');
      state.success = true;
      state.message = '수업을 정산하였습니다';
      return state;
    });
}

type UpdateInvoiceState = ServerActionState<{
  title: string;
  price: number;
  totalCount?: number;
  notes: string;
}>;
const updateInvoiceSchema = z.object({
  title: z.string(),
  price: z.coerce.number().int().min(0),
  totalCount: z.coerce.number().int().min(0).optional(),
  notes: z.string(),
});
export async function updateInvoice(state: UpdateInvoiceState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateInvoice',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { invoiceUuid, ...data } = Object.fromEntries(formData.entries());

      const state: UpdateInvoiceState = {
        success: false,
        fields: {
          title: data.title as string,
          price: Number(data.price),
          totalCount: data.totalCount !== undefined ? Number(data.totalCount) : undefined,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };
      const session = await getSession();

      if (!session?.organization) {
        return state;
      }

      const validationResult = updateInvoiceSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      await invoicesApi.update(invoiceUuid as string, {
        title: validationResult.data.title,
        price: validationResult.data.price,
        ...(validationResult.data.totalCount !== undefined && { totalCount: validationResult.data.totalCount }),
        notes: validationResult.data.notes,
      });

      revalidatePath('/students', 'layout');
      revalidatePath('/invoices', 'page');
      state.success = true;
      return state;
    },
  );
}

type RemoveInvoiceState = ServerActionState<null>;
export async function removeInvoice(prevState: any, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'removeInvoice',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const invoiceUuid = formData.get('invoiceUuid') as string;

      const state: RemoveInvoiceState = {
        success: false,
        timestamp: Date.now(),
      };
      const session = await getSession();

      if (!session?.organization) {
        return state;
      }

      await invoicesApi.remove(invoiceUuid);

      revalidatePath('/students', 'layout');
      revalidatePath('/invoices', 'page');
      revalidatePath('/sessions', 'page');
      state.success = true;
      state.message = '수강권을 삭제하였습니다';
      return state;
    });
}
