'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalProps, Surface, toast } from '@heroui/react';
import { FolderInput, Folder, Home, ChevronRight, Check } from 'lucide-react';

import { moveFileToFolder, getMyFolders } from '@/actions/storage';
import type { TMediaFile, TFolder } from '@/types/index';

interface MoveFileModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  file: TMediaFile | null;
}

export default function MoveFileModal({ isOpen, onOpenChange, file }: MoveFileModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-md">
        <Modal.Dialog>
          {({ close }) => file && <Content file={file} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  file: TMediaFile;
  close: () => void;
}

function Content({ file, close }: ContentProps) {
  const router = useRouter();
  const [folders, setFolders] = React.useState<TFolder[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMoving, setIsMoving] = React.useState(false);
  const [selectedFolderUuid, setSelectedFolderUuid] = React.useState<string | null>(
    file.folder?.uuid || null
  );

  React.useEffect(() => {
    const loadFolders = async () => {
      const result = await getMyFolders();
      setFolders(result);
      setIsLoading(false);
    };
    loadFolders();
  }, []);

  const handleMove = async () => {
    // 같은 폴더면 아무것도 안함
    const currentFolderUuid = file.folder?.uuid || null;
    if (selectedFolderUuid === currentFolderUuid) {
      close();
      return;
    }

    setIsMoving(true);

    const result = await moveFileToFolder(file.uuid, selectedFolderUuid);

    if (result.success) {
      const targetName = selectedFolderUuid
        ? folders.find(f => f.uuid === selectedFolderUuid)?.name || '선택한 폴더'
        : '루트';
      toast.success(`파일이 ${targetName}(으)로 이동되었습니다.`);
      router.refresh();
      close();
    } else {
      toast.danger('이동 실패', {
        description: result.message || '파일 이동에 실패했습니다.',
      });
    }

    setIsMoving(false);
  };

  // 폴더 트리를 플랫하게 펼침 (들여쓰기 레벨 포함)
  const flattenFolders = (
    items: TFolder[],
    level = 0
  ): Array<TFolder & { level: number }> => {
    const result: Array<TFolder & { level: number }> = [];
    for (const folder of items) {
      result.push({ ...folder, level });
      if (folder.children && folder.children.length > 0) {
        result.push(...flattenFolders(folder.children, level + 1));
      }
    }
    return result;
  };

  const flatFolders = React.useMemo(() => flattenFolders(folders), [folders]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading className="flex items-center gap-2">
          <FolderInput className="w-5 h-5" />
          파일 이동
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{file.fileName || '파일'}</span>을 이동할 위치를 선택하세요.
          </p>

          <Surface className="border border-gray-100 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-50">
            {/* 루트 옵션 */}
            <button
              type="button"
              className={`w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 transition-colors ${
                selectedFolderUuid === null ? 'bg-accent-soft' : ''
              }`}
              onClick={() => setSelectedFolderUuid(null)}
            >
              <Home className="w-5 h-5 text-gray-400" />
              <span className="flex-1">루트 (최상위)</span>
              {selectedFolderUuid === null && (
                <Check className="w-4 h-4 text-accent" />
              )}
            </button>

            {isLoading ? (
              <div className="p-4 text-center text-gray-400">
                폴더 목록 불러오는 중...
              </div>
            ) : flatFolders.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                생성된 폴더가 없습니다.
              </div>
            ) : (
              flatFolders.map((folder) => (
                <button
                  key={folder.uuid}
                  type="button"
                  className={`w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 transition-colors ${
                    selectedFolderUuid === folder.uuid ? 'bg-accent-soft' : ''
                  }`}
                  style={{ paddingLeft: `${12 + folder.level * 20}px` }}
                  onClick={() => setSelectedFolderUuid(folder.uuid)}
                >
                  {folder.level > 0 && (
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                  )}
                  <Folder className="w-5 h-5 text-gray-400" />
                  <span className="flex-1 truncate">{folder.name}</span>
                  {folder._count && folder._count.mediaFiles > 0 && (
                    <span className="text-xs text-gray-400">
                      {folder._count.mediaFiles}
                    </span>
                  )}
                  {selectedFolderUuid === folder.uuid && (
                    <Check className="w-4 h-4 text-accent" />
                  )}
                </button>
              ))
            )}
          </Surface>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close} isDisabled={isMoving}>
          취소
        </Button>
        <Button
          variant="primary"
          onPress={handleMove}
          isPending={isMoving}
        >
          이동
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
