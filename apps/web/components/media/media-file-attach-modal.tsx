'use client';

import * as React from 'react';
import {
  CheckIcon,
  VideoIcon,
  Loader2Icon,
  SearchIcon,
  XIcon,
  FolderIcon,
  ChevronRightIcon,
  HomeIcon,
  ImageIcon,
  FileTextIcon,
} from 'lucide-react';
import { Button, Modal, Surface, ModalProps, TextField, InputGroup, toast } from '@heroui/react';
import type { TMediaFile, TFolder, TFolderBreadcrumb, TStorageQuota, TTempMediaFile } from '@/types/index';
import { getMyMediaFiles, getMyFolders, getFolderBreadcrumb, getStorageQuota, createMediaFile } from '@/actions/storage';
import MediaFileUploadZone from './media-file-upload-zone';

interface MediaFileAttachModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  selectedUuids: string[];
  onConfirm: (selectedFiles: TMediaFile[]) => void;
  maxSelect?: number;
  selectionMode?: 'single' | 'multiple';
  enableUpload?: boolean;
  enableFolderNavigation?: boolean;
  enableSearch?: boolean;
}

type TabType = 'browse' | 'upload';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export default function MediaFileAttachModal({
  isOpen,
  onOpenChange,
  selectedUuids,
  onConfirm,
  maxSelect = 5,
  selectionMode = 'multiple',
  enableUpload = true,
  enableFolderNavigation = true,
  enableSearch = true,
}: MediaFileAttachModalProps) {
  // 데이터 상태
  const [files, setFiles] = React.useState<TMediaFile[]>([]);
  const [folders, setFolders] = React.useState<TFolder[]>([]);
  const [breadcrumb, setBreadcrumb] = React.useState<TFolderBreadcrumb[]>([]);
  const [quota, setQuota] = React.useState<TStorageQuota | null>(null);

  // 네비게이션 상태
  const [currentFolderUuid, setCurrentFolderUuid] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');

  // UI 상태
  const [activeTab, setActiveTab] = React.useState<TabType>('browse');
  const [localSelected, setLocalSelected] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFoldersLoaded, setIsFoldersLoaded] = React.useState(false);

  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // 검색 디바운스
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // 모달 열릴 때 초기화
  React.useEffect(() => {
    if (isOpen) {
      setLocalSelected(new Set());
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setCurrentFolderUuid(null);
      setBreadcrumb([]);
      setActiveTab('browse');
      setIsFoldersLoaded(false);
    }
  }, [isOpen]);

  // 폴더 목록 로드 (모달 오픈 시 1회)
  React.useEffect(() => {
    if (isOpen && !isFoldersLoaded && enableFolderNavigation) {
      getMyFolders().then((data) => {
        setFolders(data);
        setIsFoldersLoaded(true);
      });
    }
  }, [isOpen, isFoldersLoaded, enableFolderNavigation]);

  // 스토리지 용량 로드 (업로드 탭용)
  React.useEffect(() => {
    if (isOpen && enableUpload) {
      getStorageQuota().then(setQuota);
    }
  }, [isOpen, enableUpload]);

  // 파일 목록 로드
  React.useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);

    const params: { folderId?: string; search?: string } = {};

    if (debouncedSearchQuery) {
      params.search = debouncedSearchQuery;
    }
    else if (currentFolderUuid) {
      params.folderId = currentFolderUuid;
    }

    getMyMediaFiles(params)
      .then(setFiles)
      .finally(() => setIsLoading(false));
  }, [isOpen, currentFolderUuid, debouncedSearchQuery]);

  // 브레드크럼 로드
  React.useEffect(() => {
    if (!isOpen || debouncedSearchQuery) {
      setBreadcrumb([]);
      return;
    }

    if (currentFolderUuid) {
      getFolderBreadcrumb(currentFolderUuid).then(setBreadcrumb);
    }
    else {
      setBreadcrumb([]);
    }
  }, [isOpen, currentFolderUuid, debouncedSearchQuery]);

  // 현재 폴더의 하위 폴더만 표시
  const currentFolders = React.useMemo(() => {
    if (debouncedSearchQuery) return [];

    const flattenAll = (items: TFolder[]): TFolder[] => {
      const result: TFolder[] = [];
      for (const folder of items) {
        result.push(folder);
        if (folder.children && folder.children.length > 0) {
          result.push(...flattenAll(folder.children));
        }
      }
      return result;
    };

    const allFolders = flattenAll(folders);

    if (!currentFolderUuid) {
      return folders;
    }

    const currentFolder = allFolders.find((f) => f.uuid === currentFolderUuid);
    return currentFolder?.children || [];
  }, [folders, currentFolderUuid, debouncedSearchQuery]);

  const handleToggleFile = (file: TMediaFile) => {
    if (selectedUuids.includes(file.uuid)) return;

    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file.uuid)) {
        next.delete(file.uuid);
      }
      else {
        if (selectionMode === 'single') {
          next.clear();
          next.add(file.uuid);
        }
        else if (next.size < maxSelect) {
          next.add(file.uuid);
        }
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedFiles = files.filter((f) => localSelected.has(f.uuid));
    onConfirm(selectedFiles);
  };

  const handleFolderClick = (folderUuid: string) => {
    setCurrentFolderUuid(folderUuid);
  };

  const handleBreadcrumbClick = (folderUuid: string | null) => {
    setCurrentFolderUuid(folderUuid);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
  };

  const handleUploadComplete = async (tempFile: TTempMediaFile) => {
    const result = await createMediaFile({
      url: tempFile.url,
      publicId: tempFile.publicId,
      type: tempFile.type,
      contentType: tempFile.contentType,
      fileName: tempFile.fileName,
      fileSize: tempFile.fileSize,
      folderUuid: currentFolderUuid || undefined,
    });

    if (result.success && result.data) {
      setFiles((prev) => [result.data!, ...prev]);
      if (selectionMode === 'single') {
        setLocalSelected(new Set([result.data.uuid]));
      }
      else if (localSelected.size < maxSelect) {
        setLocalSelected((prev) => new Set([...prev, result.data!.uuid]));
      }
      toast.success('파일 업로드 완료', {
        description: tempFile.fileName,
        timeout: 3000,
      });
      // 용량 새로고침
      getStorageQuota().then(setQuota);
    }
    else {
      toast.danger('파일 저장 실패', {
        description: result.message || '파일을 저장할 수 없습니다.',
        timeout: 3000,
      });
    }
  };

  const getFileIcon = (type: TMediaFile['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="size-5 text-default-400" />;
      case 'video':
        return <VideoIcon className="size-5 text-default-400" />;
      case 'document':
        return <FileTextIcon className="size-5 text-default-400" />;
    }
  };

  const renderFileList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="size-6 animate-spin text-default-400" />
        </div>
      );
    }

    const hasContent = currentFolders.length > 0 || files.length > 0;

    if (!hasContent) {
      return (
        <Surface
          className="p-8 rounded-xl text-center text-sm text-default-500"
          variant="secondary"
        >
          {debouncedSearchQuery
            ? `"${debouncedSearchQuery}"에 대한 검색 결과가 없습니다.`
            : currentFolderUuid
              ? '이 폴더는 비어 있습니다.'
              : '업로드된 파일이 없습니다.'}
        </Surface>
      );
    }

    return (
      <Surface className="rounded-xl divide-y divide-default-100 max-h-80 overflow-y-auto" variant="secondary">
        {/* 폴더 */}
        {enableFolderNavigation
        && currentFolders.map((folder) => (
          <button
            key={folder.uuid}
            type="button"
            onClick={() => handleFolderClick(folder.uuid)}
            className="w-full flex items-center gap-3 p-3 hover:bg-default-100 transition-colors text-left"
          >
            <FolderIcon className="size-5 text-amber-500 shrink-0" />
            <span className="text-sm truncate">{folder.name}</span>
            <ChevronRightIcon className="size-4 text-default-400 ml-auto shrink-0" />
          </button>
        ))}

        {/* 파일 */}
        {files.map((file) => {
          const isSelected = localSelected.has(file.uuid);
          const isAlreadyAttached = selectedUuids.includes(file.uuid);

          return (
            <button
              key={file.uuid}
              type="button"
              onClick={() => handleToggleFile(file)}
              disabled={isAlreadyAttached}
              className={`
                w-full flex items-center gap-3 p-3 transition-colors text-left
                ${isAlreadyAttached ? 'opacity-50 cursor-not-allowed' : 'hover:bg-default-100 cursor-pointer'}
                ${isSelected ? 'bg-accent-soft' : ''}
              `}
            >
              {/* 썸네일 */}
              <div className="shrink-0 size-10 rounded-lg overflow-hidden bg-default-200 flex items-center justify-center">
                {file.type === 'image' ? (
                  <img
                    src={file.url}
                    alt={file.fileName || 'image'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getFileIcon(file.type)
                )}
              </div>

              {/* 파일 정보 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{file.fileName || 'Untitled'}</p>
                <p className="text-xs text-default-400">{formatBytes(file.fileSize)}</p>
              </div>

              {/* 상태 표시 */}
              {isAlreadyAttached ? (
                <span className="text-xs text-default-400 shrink-0">첨부됨</span>
              ) : isSelected ? (
                <div className="size-5 bg-accent text-white rounded-full flex items-center justify-center shrink-0">
                  <CheckIcon className="size-3" />
                </div>
              ) : (
                <div className="size-5 border-2 border-default-300 rounded-full shrink-0" />
              )}
            </button>
          );
        })}
      </Surface>
    );
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-lg">
        <Modal.Dialog>
          {({ close }) => (
            <>
              <Modal.Header>
                <Modal.Heading>파일 첨부</Modal.Heading>
              </Modal.Header>

              <Modal.Body>
                <div className="flex flex-col gap-4">
                  {/* 탭 */}
                  {enableUpload && (
                    <div className="flex gap-2">
                      <Button
                        variant={activeTab === 'browse' ? 'primary' : 'secondary'}
                        size="sm"
                        onPress={() => setActiveTab('browse')}
                      >
                        파일 선택
                      </Button>
                      <Button
                        variant={activeTab === 'upload' ? 'primary' : 'secondary'}
                        size="sm"
                        onPress={() => setActiveTab('upload')}
                      >
                        업로드
                      </Button>
                    </div>
                  )}

                  {activeTab === 'browse' && (
                    <>
                      {/* 브레드크럼 */}
                      {enableFolderNavigation && !debouncedSearchQuery && (
                        <nav className="flex items-center gap-1 text-sm text-default-500 overflow-x-auto pb-1">
                          <button
                            type="button"
                            onClick={() => handleBreadcrumbClick(null)}
                            className="flex items-center gap-1 hover:text-default-700 shrink-0"
                          >
                            <HomeIcon className="size-4" />
                            <span>전체 파일</span>
                          </button>

                          {breadcrumb.map((folder) => (
                            <React.Fragment key={folder.uuid}>
                              <ChevronRightIcon className="size-4 shrink-0 text-default-300" />
                              <button
                                type="button"
                                onClick={() => handleBreadcrumbClick(folder.uuid)}
                                className="hover:text-default-700 truncate max-w-[150px]"
                                title={folder.name}
                              >
                                {folder.name}
                              </button>
                            </React.Fragment>
                          ))}
                        </nav>
                      )}

                      {/* 검색바 */}
                      {enableSearch && (
                        <TextField
                          aria-label="파일 검색"
                          value={searchQuery}
                          onChange={setSearchQuery}
                        >
                          <InputGroup>
                            <InputGroup.Prefix>
                              <SearchIcon className="size-4 text-default-400" />
                            </InputGroup.Prefix>
                            <InputGroup.Input placeholder="파일명으로 검색..." />
                            {searchQuery && (
                              <InputGroup.Suffix>
                                <button
                                  type="button"
                                  onClick={clearSearch}
                                  className="p-1 hover:bg-default-100 rounded"
                                >
                                  <XIcon className="size-3.5 text-default-400" />
                                </button>
                              </InputGroup.Suffix>
                            )}
                          </InputGroup>
                        </TextField>
                      )}

                      {/* 파일 목록 */}
                      {renderFileList()}
                    </>
                  )}

                  {activeTab === 'upload' && (
                    <div className="flex flex-col gap-4">
                      {quota && (
                        <div className="text-sm text-default-500">
                          저장 공간: {formatBytes(quota.usedBytes)} / {formatBytes(quota.quotaBytes)} 사용 중
                        </div>
                      )}
                      <MediaFileUploadZone
                        onUploadComplete={handleUploadComplete}
                        remainingBytes={quota?.remainingBytes}
                      />
                      {localSelected.size > 0 && (
                        <Surface className="p-3 rounded-lg" variant="secondary">
                          <span className="text-sm text-default-600">
                            {localSelected.size}개 파일 선택됨
                          </span>
                        </Surface>
                      )}
                    </div>
                  )}
                </div>
              </Modal.Body>

              <Modal.Footer>
                <Button variant="ghost" onPress={close}>
                  취소
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    handleConfirm();
                    close();
                  }}
                  isDisabled={localSelected.size === 0}
                >
                  선택 완료 ({localSelected.size})
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
