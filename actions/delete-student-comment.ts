'use server';

import { prisma } from '@/utils/prisma';
import { createClient } from '@/utils/supabase';
import { revalidatePath } from 'next/cache';

export async function deleteStudentComment(commentId: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 코멘트가 현재 사용자의 것인지 확인
  const existingComment = await prisma.studentComment.findFirst({
    where: {
      id: commentId,
      userId: user.id,
      deletedAt: null,
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