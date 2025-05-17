import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';

import Student from './_student';

import { notFound, redirect } from 'next/navigation';

export default async function Page({ params }) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const student = await prisma.student.findUnique({
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
    },
    where: {
      id: Number(studentId),
      userId: user.id,
    },
  });

  if (!student) {
    return notFound();
  }

  const syllabuses = await prisma.syllabus.findMany({
    select: {
      title: true,
      notes: true,
      payment: {
        select: {
          amount: true,
          paymentMethod: true,
          notes: true,
          paidAt: true,
        },
      },
      lessons: {
        select: {
          id: true,
          isDone: true,
          lessonAt: true,
          notes: true,
          feedback: {
            select: {
              notes: true,
            },
          },
        },
        orderBy: {
          lessonAt: 'desc',
        },
      },
    },
    where: {
      studentId: student.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(syllabuses);

  return (
    <Student student={student} syllabuses={syllabuses} />
  );
}
