'use server';
import * as Sentry from '@sentry/nextjs';
import { headers } from 'next/headers';

export default async function deleteLesson(formData: FormData) {
  return await Sentry.withServerActionInstrumentation(
    'deleteLesson',
    {
      formData,
      headers: await headers(),
      recordResponse: true,
    },
    async () => {
      // ... Your Server Action code
      return { name: 'John Doe' };
    },
  );
}
