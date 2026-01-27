import { getStorageQuota, getMyMediaFiles, getMyFolders, getFolderBreadcrumb } from '@/actions/storage';

import StorageQuotaCard from './_storage-quota-card';
import FilterBar, { UploadButton, NewFolderButton } from './_filter-bar';
import FilesList from './_files-list';
import FolderBreadcrumb from './_folder-breadcrumb';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  sort?: string;
  q?: string;
  folder?: string;
}>;

interface PageProps {
  searchParams: SearchParams;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const sortOrder = (params.sort || 'newest') as 'newest' | 'oldest' | 'largest' | 'smallest';
  const searchQuery = params.q || '';
  const currentFolderUuid = params.folder || undefined;

  // 검색 중이면 전체 검색, 아니면 현재 폴더의 파일만
  const fileParams = searchQuery
    ? { search: searchQuery }
    : currentFolderUuid
      ? { folderId: currentFolderUuid }
      : { folderId: 'root' };

  const [quota, files, folders, breadcrumb] = await Promise.all([
    getStorageQuota(),
    getMyMediaFiles(fileParams),
    getMyFolders(),
    currentFolderUuid ? getFolderBreadcrumb(currentFolderUuid) : Promise.resolve([]),
  ]);

  return (
    <div>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">파일 관리</h1>
        <div className="flex items-center gap-2">
          <NewFolderButton parentFolderUuid={currentFolderUuid} />
          <UploadButton quota={quota} currentFolderUuid={currentFolderUuid} />
        </div>
      </header>
      <div className="mt-6 flex flex-col gap-6">
        <StorageQuotaCard quota={quota} />

        {/* Breadcrumb - 폴더 내부에 있을 때만 표시 */}
        {breadcrumb.length > 0 && (
          <FolderBreadcrumb breadcrumb={breadcrumb} />
        )}

        <FilterBar
          sortOrder={sortOrder}
          searchQuery={searchQuery}
          currentFolderUuid={currentFolderUuid}
        />
        <FilesList
          files={files}
          folders={folders}
          sortOrder={sortOrder}
          searchQuery={searchQuery}
          currentFolderUuid={currentFolderUuid}
        />
      </div>
    </div>
  );
}
