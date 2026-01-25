'use client';

import * as React from 'react';
import { Button, Modal, ModalProps } from '@heroui/react';
import { X, ImageIcon, Video } from 'lucide-react';

import type { TMediaFile } from '@/types/index';

interface FilePreviewModalProps {
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

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function FilePreviewModal({ isOpen, onOpenChange, file }: FilePreviewModalProps) {
  if (!file) return null;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-4xl">
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
  const fileName = file.fileName || 'Untitled';

  return (
    <React.Fragment>
      <Modal.Header>
        <div className="flex items-center gap-2">
          {file.type === 'image'
            ? <ImageIcon className="w-5 h-5 text-gray-500" />
            : <Video className="w-5 h-5 text-gray-500" />}
          <Modal.Heading className="truncate">{fileName}</Modal.Heading>
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
        <div className="flex items-center justify-center bg-gray-900 min-h-[300px] max-h-[70vh]">
          {file.type === 'image'
            ? (
                <img
                  src={file.url}
                  alt={fileName}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )
            : (
                <video
                  src={file.url}
                  controls
                  className="max-w-full max-h-[70vh]"
                >
                  브라우저가 동영상 재생을 지원하지 않습니다.
                </video>
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
