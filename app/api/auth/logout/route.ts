import { auth } from '@/utils/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  await auth.api.signOut({
    headers: await headers(),
  });

  return NextResponse.json({ success: true });
}
