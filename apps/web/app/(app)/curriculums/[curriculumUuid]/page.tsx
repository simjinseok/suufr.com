import { notFound } from 'next/navigation';
import { getSession } from '@/utils/auth';
import { curriculumsApi } from '@/utils/api';

import Curriculum from './_curriculum';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ curriculumUuid: string }>;
};

export default async function Page({ params }: Props) {
  const { curriculumUuid } = await params;

  const session = await getSession();
  if (!session?.organization) {
    return null;
  }

  try {
    const response = await curriculumsApi.get(curriculumUuid);
    const curriculum = response.data;

    return <Curriculum curriculum={curriculum} />;
  }
  catch {
    notFound();
  }
}
