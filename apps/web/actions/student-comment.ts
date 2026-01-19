'use server';

import prisma from '@/utils/prisma';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { getSession } from '@/utils/auth';
import { ServerActionState } from '@/types/index';

type CreateStudentCommentState = ServerActionState<{
  content: string;
}>;
export async function createStudentComment(prevState: CreateStudentCommentState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentComment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      if (!session?.organization) {
        throw new Error('Unauthorized');
      }
      const { organization } = session;

      const state: CreateStudentCommentState = {
        success: false,
        fields: {
          content: (formData.get('content') as string) || '',
        },
        timestamp: Date.now(),
      };
      const studentUuid = formData.get('studentUuid') as string;
      const content = (formData.get('content') as string) || '';

      // 학생이 현재 조직의 것인지 확인
      const student = await prisma.student.findFirst({
        where: {
          uuid: studentUuid,
          organizationId: organization.id,
          deletedAt: null,
        },
      });

      if (!student) {
        return state;
      }

      const comment = await prisma.studentComment.create({
        data: {
          content,
          studentId: student.id,
        },
      });

      revalidatePath(`/students/[studentUuid]/@comments`)
      state.success = true;
      state.message = '코멘트를 작성하였습니다.';
      return state;
    },
  );
}

type UpdateStudentCommentState = ServerActionState<{
  content: string;
}>;
export async function updateStudentComment(prevState: UpdateStudentCommentState, formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentComment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      if (!session?.organization) {
        throw new Error('Unauthorized');
      }
      const { organization } = session;

      const state: UpdateStudentCommentState = {
        success: false,
        fields: {
          content: (formData.get('content') as string) || '',
        },
        timestamp: Date.now(),
      };

      const commentUuid = formData.get('commentUuid') as string;
      const content = (formData.get('content') as string) || '';

      // 코멘트가 현재 조직의 것인지 확인
      const comment = await prisma.studentComment.findFirst({
        where: {
          uuid: commentUuid,
          deletedAt: null,
          student: {
            organizationId: organization.id,
          },
        },
        include: {
          student: true,
        },
      });

      if (!comment) {
        return state;
      }

      const result = await prisma.studentComment.update({
        where: {
          id: comment.id,
        },
        data: {
          content,
        },
      });

      state.success = true;
      return state;
    },
  );
}

export async function deleteStudentComment(commentId: number) {
  return await Sentry.withServerActionInstrumentation(
    'deleteStudentComment',
    {
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const session = await getSession();

      if (!session?.organization) {
        throw new Error('Unauthorized');
      }
      const { organization } = session;

      // 코멘트가 현재 조직의 것인지 확인
      const existingComment = await prisma.studentComment.findFirst({
        where: {
          id: commentId,
          deletedAt: null,
          student: {
            organizationId: organization.id,
          },
        },
      });

      if (!existingComment) {
        throw new Error('Comment not found');
      }

      // 소프트 삭제
      await prisma.studentComment.update({
        where: {
          id: commentId,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      revalidatePath(`/students/${existingComment.studentId}`);

      return { success: true };
    },
  );
}
