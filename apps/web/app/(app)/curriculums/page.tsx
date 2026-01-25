import { getSession } from '@/utils/auth';
import { curriculumsApi } from '@/utils/api';

import Heading from './_heading';
import Curriculums from './_curriculums';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ search?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { search } = await searchParams;

  const session = await getSession();
  if (!session?.organization) {
    return null;
  }

  const response = await curriculumsApi.list({ search });
  const curriculums = response.data;

  return (
    <div>
      <Heading search={search} />
      <Curriculums curriculums={curriculums} />
    </div>
  );
}
