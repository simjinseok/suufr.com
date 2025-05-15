import { createClient } from '@/utils/supabase';
import { prisma } from '@/utils/prisma';

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('', {
      status: 401,
    });
  }

  const formData = await req.formData();

  const result = await prisma.student.create({
    data: {
      userId: user.id,
      name: formData.get('name') as string,
      status: formData.get('status') as string,
      notes: formData.get('notes') as string,
    },
  });

  return Response.json(
    { ...result },
    {
      status: 201,
    },
  );
}
