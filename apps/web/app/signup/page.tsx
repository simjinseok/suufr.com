import { redirect } from 'next/navigation';

import { getSession } from '@/utils/auth';
import SignupForm from './signup-form';

export default async function SignupPage() {
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  }

  return <SignupForm />;
}
