import { getStorageQuota, getMyMediaFiles } from '@/actions/storage';

import StorageQuotaCard from './_storage-quota-card';
import FilterBar from './_filter-bar';
import FilesList from './_files-list';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  sort?: string;
  q?: string;
}>;

interface PageProps {
  searchParams: SearchParams;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const sortOrder = (params.sort || 'newest') as 'newest' | 'oldest' | 'largest' | 'smallest';
  const searchQuery = params.q || '';

  const [quota, files] = await Promise.all([
    getStorageQuota(),
    getMyMediaFiles(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">파일 관리</h1>
      <div className="mt-6 flex flex-col gap-6">
        <StorageQuotaCard quota={quota} />
        <FilterBar
          sortOrder={sortOrder}
          searchQuery={searchQuery}
          quota={quota}
        />
        <FilesList
          files={files}
          sortOrder={sortOrder}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
}
