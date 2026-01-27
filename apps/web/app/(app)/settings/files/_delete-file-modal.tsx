'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, ModalProps, toast } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';

import { deleteMediaFile } from '@/actions/storage';
import type { TMediaFile } from '@/types/index';

interface DeleteFileModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  file: TMediaFile | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export default function DeleteFileModal({ isOpen, onOpenChange, file }: DeleteFileModalProps) {
  if (!file) return null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content file={file} close={close} />
          )}
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
  const [isDeleting, setIsDeleting] = React.useState(false);
  const fileName = file.fileName || 'Untitled';

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteMediaFile(file.uuid);

      if (result.success) {
        toast.success('파일 삭제 완료', {
          description: '파일이 성공적으로 삭제되었습니다.',
          timeout: 3000,
        });
        close();
        router.refresh();
      }
      else {
        toast.danger('파일 삭제 실패', {
          description: result.message || '파일을 삭제할 수 없습니다.',
          timeout: 3000,
        });
      }
    }
    finally {
      setIsDeleting(false);
    }
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>파일 삭제</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-danger-soft rounded-full">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div>
            <p className="font-medium">이 파일을 삭제하시겠습니까?</p>
            <p className="mt-1 text-sm text-gray-500">
              삭제된 파일은 복구할 수 없습니다.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">{formatBytes(file.fileSize)}</p>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close} isDisabled={isDeleting}>
          취소
        </Button>
        <Button variant="danger" onPress={handleDelete} isPending={isDeleting}>
          삭제
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
