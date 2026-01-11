import { createClient } from '@/utils/supabase';
import prisma from '@/utils/prisma';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: { params: { syllabusId: string } }) {
  const { syllabusId: _syllabusId } = await params;
  const syllabusId = Number(_syllabusId);
  if (Number.isNaN(syllabusId)) {
    return notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const syllabus = await prisma.syllabus.findUnique({
    select: {
      id: true,
      title: true,
      notes: true,
      student: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      payment: {
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          notes: true,
          paidAt: true,
        },
      },
    },
    where: {
      id: syllabusId,
      student: {
        userId: user.id,
      },
    },
  });

  if (!syllabus) {
    return notFound();
  }

  return <div>ff</div>;
}
