'use client';

import * as React from 'react';
import { CheckIcon, VideoIcon, Loader2Icon } from 'lucide-react';
import { Button, Modal, Surface, ModalProps } from '@heroui/react';
import type { TMediaFile } from '@/types/index';
import { getMyMediaFiles } from '@/actions/storage';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  selectedUuids: string[];
  onConfirm: (selectedFiles: TMediaFile[]) => void;
  maxSelect?: number;
}

export default function MediaFileSelectModal({
  isOpen,
  onOpenChange,
  selectedUuids,
  onConfirm,
  maxSelect = 5,
}: Props) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [files, setFiles] = React.useState<TMediaFile[]>([]);
  const [localSelected, setLocalSelected] = React.useState<Set<string>>(new Set());

  // 모달 열릴 때 데이터 로드
  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setLocalSelected(new Set(selectedUuids));

      getMyMediaFiles()
        .then((filesData) => {
          setFiles(filesData);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, selectedUuids]);

  const handleToggleFile = (uuid: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      }
      else if (next.size < maxSelect) {
        next.add(uuid);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedFiles = files.filter((f) => localSelected.has(f.uuid));
    onConfirm(selectedFiles);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog size="lg">
          {({ close }) => (
            <>
              <Modal.Header>
                <Modal.Heading>파일 선택</Modal.Heading>
              </Modal.Header>

              <Modal.Body>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2Icon className="size-6 animate-spin text-default-400" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* 파일 목록 */}
                    {files.length === 0 ? (
                      <Surface
                        className="p-8 rounded-xl text-center text-sm text-default-500"
                        variant="secondary"
                      >
                        업로드된 파일이 없습니다.
                        <br />
                        파일관리에서 파일을 먼저 업로드해주세요.
                      </Surface>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto">
                        {files.map((file) => {
                          const isSelected = localSelected.has(file.uuid);
                          const isAlreadyAttached = selectedUuids.includes(file.uuid);

                          return (
                            <button
                              key={file.uuid}
                              type="button"
                              onClick={() => handleToggleFile(file.uuid)}
                              className={`
                                relative aspect-square rounded-lg overflow-hidden
                                transition-all cursor-pointer
                                ${isSelected ? 'ring-2 ring-accent' : 'hover:ring-2 hover:ring-default-300'}
                                ${isAlreadyAttached ? 'opacity-50' : ''}
                              `}
                            >
                              <Surface
                                className="w-full h-full flex items-center justify-center"
                                variant="secondary"
                              >
                                {file.type === 'video' ? (
                                  <VideoIcon className="size-8 text-default-400" />
                                ) : (
                                  <img
                                    src={file.url}
                                    alt={file.fileName || 'image'}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </Surface>
                              {isSelected && (
                                <div className="absolute top-1 right-1 size-5 bg-accent text-white rounded-full flex items-center justify-center">
                                  <CheckIcon className="size-3" />
                                </div>
                              )}
                              {isAlreadyAttached && !isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <span className="text-xs text-white">첨부됨</span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
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
