'use client';

import * as React from 'react';
import { Button, Modal, ModalProps } from '@heroui/react';
import { X, ImageIcon, Video } from 'lucide-react';

interface MediaFile {
  url: string;
  type: 'image' | 'video';
  fileName: string | null;
}

interface FilePreviewModalProps {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  file: MediaFile | null;
}

export default function FilePreviewModal({ isOpen, onOpenChange, file }: FilePreviewModalProps) {
  if (!file) return null;

  const fileName = file.fileName || '파일';

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container className="max-w-4xl">
        <Modal.Dialog>
          {({ close }) => (
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
              </Modal.Body>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
