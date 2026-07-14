'use client';

import * as React from 'react';
import { Button, Modal, ModalProps } from '@heroui/react';
import { X, ImageIcon, Video, FileTextIcon, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

import type { TMediaFile } from '@/types/index';
import { formatBytes } from '@/utils/format-bytes';

interface FilePreviewModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  files: TMediaFile[];
  index: number | null;
  onNavigate: (index: number) => void;
}


function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function FilePreviewModal({ isOpen, onOpenChange, files, index, onNavigate }: FilePreviewModalProps) {
  if (index === null || !files[index]) return null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-4xl">
        <Modal.Dialog>
          {({ close }) => (
            <Content files={files} index={index} onNavigate={onNavigate} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  files: TMediaFile[];
  index: number;
  onNavigate: (index: number) => void;
  close: () => void;
}

function Content({ files, index, onNavigate, close }: ContentProps) {
  const file = files[index];
  const fileName = file.fileName || 'Untitled';
  const hasPrev = index > 0;
  const hasNext = index < files.length - 1;

  // 키보드 좌/우 화살표로 이전/다음 (양끝에서는 무시, 랩어라운드 없음)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) {
        onNavigate(index - 1);
      }
      else if (e.key === 'ArrowRight' && hasNext) {
        onNavigate(index + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, hasPrev, hasNext, onNavigate]);

  const getTypeIcon = () => {
    switch (file.type) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-gray-500" />;
      case 'video':
        return <Video className="w-5 h-5 text-gray-500" />;
      case 'document':
        return <FileTextIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <div className="flex items-center gap-2 min-w-0">
          {getTypeIcon()}
          <Modal.Heading className="truncate">{fileName}</Modal.Heading>
          {files.length > 1 && (
            <span className="shrink-0 text-sm text-gray-400 tabular-nums">
              {index + 1} / {files.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          onPress={close}
        >
          <X className="w-4 h-4" />
        </Button>
      </Modal.Header>
      <Modal.Body className="p-0">
        <div className="relative flex items-center justify-center bg-gray-900 min-h-[300px] max-h-[70vh]">
          {file.type === 'image'
            ? (
                <img
                  src={file.url}
                  alt={fileName}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )
            : file.type === 'video'
              ? (
                  <video
                    key={file.uuid}
                    src={file.url}
                    controls
                    className="max-w-full max-h-[70vh]"
                  >
                    브라우저가 동영상 재생을 지원하지 않습니다.
                  </video>
                )
              : (
                  <div className="flex flex-col items-center justify-center gap-4 p-8">
                    <FileTextIcon className="w-16 h-16 text-gray-400" />
                    <p className="text-gray-400 text-center">{fileName}</p>
                    <Button
                      variant="primary"
                      onPress={() => window.open(file.url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      새 탭에서 열기
                    </Button>
                  </div>
                )}

          {files.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                isDisabled={!hasPrev}
                onPress={() => onNavigate(index - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
                aria-label="이전 파일"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                isDisabled={!hasNext}
                onPress={() => onNavigate(index + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
                aria-label="다음 파일"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
        <div className="p-4 border-t border-gray-100">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500">파일 크기</dt>
              <dd className="font-medium">{formatBytes(file.fileSize)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">업로드 날짜</dt>
              <dd className="font-medium">{formatDateTime(file.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </Modal.Body>
    </React.Fragment>
  );
}
