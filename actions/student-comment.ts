'use server';

import prisma from '@/utils/prisma';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';
import { getSession } from '@/utils/auth';

export async function createStudentComment(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'createStudentComment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const studentId = Number(formData.get('studentId'));
      const content = (formData.get('content') as string) || '';

      // 학생이 현재 사용자의 것인지 확인
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          userId: user.id,
          deletedAt: null,
        },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      const comment = await prisma.studentComment.create({
        data: {
          content,
          studentId,
        },
      });

      return comment;
    },
  );
}

export async function updateStudentComment(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'updateStudentComment',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      const { user } = await getSession();

      if (!user) {
        throw new Error('Unauthorized');
      }

      const commentId = Number(formData.get('id'));
      const content = (formData.get('content') as string) || '';

      // 코멘트가 현재 사용자의 것인지 확인
      const existingComment = await prisma.studentComment.findFirst({
        where: {
          id: commentId,
          deletedAt: null,
        },
        include: {
          student: true,
        },
      });

      if (!existingComment) {
        throw new Error('Comment not found');
      }

      const comment = await prisma.studentComment.update({
        where: {
          id: commentId,
        },
        data: {
          content,
        },
      });

      return comment;
    },
  );
}

export async function deleteStudentComment(commentId: number) {
  const { user } = await getSession();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 코멘트가 현재 사용자의 것인지 확인
  const existingComment = await prisma.studentComment.findFirst({
    where: {
      id: commentId,
      deletedAt: null,
      student: {
        userId: user.id,
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
}
