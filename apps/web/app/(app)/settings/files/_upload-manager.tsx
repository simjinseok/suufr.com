'use client';

import * as React from 'react';
import { Button, Surface } from '@heroui/react';
import { Upload, UploadCloud } from 'lucide-react';

import type { TStorageQuota } from '@/types/index';
import UploadFileModal from './_upload-file-modal';

interface Props {
  quota: TStorageQuota | null;
  currentFolderUuid?: string;
}

/**
 * 파일 관리 페이지의 업로드 진입점.
 * "업로드" 버튼과 전면 드래그앤드롭(페이지 아무 곳에나 드롭 → 업로드 모달)을 담당한다.
 */
export default function UploadManager({ quota, currentFolderUuid }: Props) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isDropTargetVisible, setIsDropTargetVisible] = React.useState(false);
  const [droppedFiles, setDroppedFiles] = React.useState<File[] | undefined>(undefined);
  const [modalSession, setModalSession] = React.useState(0);
  const isModalOpenRef = React.useRef(false);
  isModalOpenRef.current = isModalOpen;

  React.useEffect(() => {
    // dragenter/leave는 자식 요소마다 쌍으로 발생하므로 depth로 실제 진입/이탈을 판정
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e) || isModalOpenRef.current) return;
      depth++;
      setIsDropTargetVisible(true);
    };
    const onDragOver = (e: DragEvent) => {
      // 브라우저의 기본 동작(파일을 새 탭으로 열기) 차단 — 모달이 열려 있어도 항상
      if (hasFiles(e)) e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e) || isModalOpenRef.current) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDropTargetVisible(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setIsDropTargetVisible(false);
      // 모달이 이미 열려 있으면 모달 안의 업로드 존이 자체 처리
      if (isModalOpenRef.current) return;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) {
        setDroppedFiles(files);
        setModalSession((n) => n + 1);
        setIsModalOpen(true);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const openModal = () => {
    setDroppedFiles(undefined);
    setModalSession((n) => n + 1);
    setIsModalOpen(true);
  };

  return (
    <>
      <Button variant="primary" onPress={openModal}>
        <Upload className="w-4 h-4 mr-1" />
        업로드
      </Button>

      {isDropTargetVisible && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center pointer-events-none">
          <Surface className="rounded-2xl border-2 border-dashed border-accent px-10 py-8 flex flex-col items-center gap-2">
            <UploadCloud className="w-10 h-10 text-accent" />
            <p className="text-base font-medium">여기에 파일을 놓아 업로드</p>
          </Surface>
        </div>
      )}

      {/* key로 열 때마다 리마운트 → 이전 세션의 업로드 목록/initialFiles 상태 초기화 */}
      <UploadFileModal
        key={modalSession}
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setDroppedFiles(undefined);
        }}
        quota={quota}
        folderUuid={currentFolderUuid}
        initialFiles={droppedFiles}
      />
    </>
  );
}
