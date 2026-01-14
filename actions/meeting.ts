'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import prisma from '@/utils/prisma';
import { parseZonedDateTime } from '@internationalized/date';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';

type CreateMeetingState = ServerActionState<{
  name: string;
  meetingAt: string;
  phone: string;
  notes: string;
}>;

const createMeetingSchema = z.object({
  name: z.string().min(1, { message: '이름을 입력해주세요' }),
  meetingAt: z.string().min(1, { message: '날짜를 선택해주세요' }),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function createMeeting(prevState: CreateMeetingState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createMeeting',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const data = Object.fromEntries(formData.entries());

      const state: CreateMeetingState = {
        success: false,
        fields: {
          name: data.name as string,
          meetingAt: data.meetingAt as string,
          phone: data.phone as string,
          notes: data.notes as string,
        },
        timestamp: Date.now(),
      };

      const { user } = await getSession();

      if (!user?.id) {
        return state;
      }

      const validationResult = createMeetingSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const meetingAt = parseZonedDateTime(validationResult.data.meetingAt).toDate();

      await prisma.meeting.create({
        data: {
          userId: user.id,
          name: validationResult.data.name,
          meetingAt,
          phone: validationResult.data.phone || null,
          notes: validationResult.data.notes || null,
          isDone: false,
        },
      });

      revalidatePath('/meetings', 'page');
      state.success = true;
      state.message = '상담을 추가하였습니다';
      return state;
    },
  );
}

type UpdateMeetingState = ServerActionState<{
  name: string;
  meetingAt: string;
  phone: string;
  notes: string;
  isDone: boolean;
}>;

const updateMeetingSchema = z.object({
  name: z.string().min(1, { message: '이름을 입력해주세요' }),
  meetingAt: z.string().min(1, { message: '날짜를 선택해주세요' }),
  phone: z.string().optional(),
  notes: z.string().optional(),
  isDone: z.string().optional(),
});

export async function updateMeeting(prevState: UpdateMeetingState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateMeeting',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const meetingId = Number(formData.get('meetingId'));
      const data = Object.fromEntries(formData.entries());

      const state: UpdateMeetingState = {
        success: false,
        fields: {
          name: data.name as string,
          meetingAt: data.meetingAt as string,
          phone: data.phone as string,
          notes: data.notes as string,
          isDone: data.isDone === 'on',
        },
        timestamp: Date.now(),
      };

      const { user } = await getSession();

      if (!user?.id) {
        return state;
      }

      const validationResult = updateMeetingSchema.safeParse(data);
      if (!validationResult.success) {
        state.fieldErrors = z.flattenError(validationResult.error).fieldErrors;
        return state;
      }

      const meeting = await prisma.meeting.findUnique({
        where: {
          id: meetingId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!meeting) {
        return state;
      }

      const meetingAt = parseZonedDateTime(validationResult.data.meetingAt).toDate();

      await prisma.meeting.update({
        where: {
          id: meeting.id,
        },
        data: {
          name: validationResult.data.name,
          meetingAt,
          phone: validationResult.data.phone || null,
          notes: validationResult.data.notes || null,
          isDone: validationResult.data.isDone === 'on',
          updatedAt: new Date(),
        },
      });

      revalidatePath('/meetings', 'page');
      state.success = true;
      state.message = '상담을 수정하였습니다';
      return state;
    },
  );
}
