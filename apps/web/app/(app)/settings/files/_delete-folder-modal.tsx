'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalProps, Surface, toast } from '@heroui/react';
import { AlertTriangle, Folder } from 'lucide-react';

import { deleteFolder } from '@/actions/storage';
import type { TFolder } from '@/types/index';

interface DeleteFolderModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  folder: TFolder | null;
}

export default function DeleteFolderModal({ isOpen, onOpenChange, folder }: DeleteFolderModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-sm">
        <Modal.Dialog>
          {({ close }) => folder && <Content folder={folder} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  folder: TFolder;
  close: () => void;
}

function Content({ folder, close }: ContentProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const fileCount = folder._count?.mediaFiles || 0;
  const hasChildren = (folder.children?.length || 0) > 0;

  const handleDelete = async () => {
    setIsDeleting(true);

    const result = await deleteFolder(folder.uuid);

    if (result.success) {
      const { deletedFolders, deletedFiles } = result.data || { deletedFolders: 1, deletedFiles: 0 };
      let message = '폴더가 삭제되었습니다.';
      if (deletedFiles > 0 || deletedFolders > 1) {
        const parts = [];
        if (deletedFolders > 1) parts.push(`폴더 ${deletedFolders}개`);
        if (deletedFiles > 0) parts.push(`파일 ${deletedFiles}개`);
        message = `${parts.join(', ')}가 삭제되었습니다.`;
      }
      toast.success(message, {
        timeout: 3000,
      });
      router.push('/settings/files');
      router.refresh();
      close();
    } else {
      toast.danger('삭제 실패', {
        description: result.message || '폴더 삭제에 실패했습니다.',
        timeout: 3000,
      });
    }

    setIsDeleting(false);
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading className="flex items-center gap-2 text-danger">
          <AlertTriangle className="w-5 h-5" />
          폴더 삭제
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <Surface className="p-4 rounded-lg flex items-center gap-3" variant="secondary">
            <Folder className="w-10 h-10 text-gray-400" />
            <div>
              <p className="font-medium">{folder.name}</p>
              {fileCount > 0 && (
                <p className="text-sm text-gray-500">파일 {fileCount}개</p>
              )}
            </div>
          </Surface>

          <div className="text-sm text-gray-600 space-y-2">
            <p>이 폴더를 삭제하시겠습니까?</p>
            {(fileCount > 0 || hasChildren) && (
              <Surface className="p-3 rounded-lg bg-danger-soft text-danger">
                <p className="font-medium flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  주의
                </p>
                <p className="mt-1">
                  폴더 내의 모든 파일{hasChildren && '과 하위 폴더'}가 함께 삭제됩니다.
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </Surface>
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close} isDisabled={isDeleting}>
          취소
        </Button>
        <Button
          variant="danger"
          onPress={handleDelete}
          isPending={isDeleting}
        >
          삭제
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
