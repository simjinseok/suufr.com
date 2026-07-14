'use client';
import type { ModalProps } from '@heroui/react';
import type { TStudentShare } from '@/types/index';

import * as React from 'react';
import {
  Button,
  Checkbox,
  Label,
  Modal,
  TextField,
  Input,
} from '@heroui/react';
import { CopyIcon, CheckIcon, LinkIcon } from 'lucide-react';

import { createStudentShare, deleteStudentShare } from '@/actions/student-share';

type Props = {
  isOpen?: ModalProps['isOpen'];
  onOpenChange?: ModalProps['onOpenChange'];
  studentUuid: string;
  shares?: TStudentShare[];
};

type ShareState = {
  shareId: string;
  expiresAt: string;
} | null;

export default function ShareModal({ isOpen, onOpenChange, studentUuid, shares }: Props) {
  const activeShare = shares?.[0];
  const [shareState, setShareState] = React.useState<ShareState>(
    activeShare ? { shareId: activeShare.shareId, expiresAt: activeShare.expiresAt.toString() } : null,
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPayments, setShowPayments] = React.useState(activeShare?.showPayments ?? true);
  const [copied, setCopied] = React.useState(false);

  // 공유 링크 생성
  const handleCreateShare = React.useCallback(async () => {
    setIsLoading(true);
    const formData = new FormData();
    formData.set('studentUuid', studentUuid);
    formData.set('showPayments', String(showPayments));

    const result = await createStudentShare({ success: false, timestamp: 0 }, formData);

    if (result.success && result.shareId && result.expiresAt) {
      setShareState({ shareId: result.shareId, expiresAt: result.expiresAt });
    }
    setIsLoading(false);
  }, [studentUuid, showPayments]);

  // 공유 링크 무효화
  const handleRevokeShare = React.useCallback(async () => {
    if (!confirm('공유 링크를 무효화하시겠습니까?')) return;
    if (!shareState) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.set('shareId', shareState.shareId);

    await deleteStudentShare({ success: false, timestamp: 0 }, formData);
    setShareState(null);
    setIsLoading(false);
  }, [shareState]);

  // 클립보드 복사
  const handleCopy = React.useCallback(async () => {
    if (shareState) {
      await navigator.clipboard.writeText(`https://suufr.com/sl/${shareState.shareId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareState]);

  const shareUrl = shareState ? `https://suufr.com/sl/${shareState.shareId}` : '';

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>
                  수업 공유
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-gray-600 mb-4">
                  학생·학부모에게 최근 수업과 피드백을 공유할 수 있습니다.
                </p>

                {shareState ? (
                  // 활성 공유 링크가 있는 경우
                  <div className="p-1 space-y-4">
                    <div className="p-3 rounded-lg bg-gray-50">
                      <div className="flex items-end gap-2 ">
                        <TextField className="flex-1">
                          <Label className="text-xs text-gray-500">공유 링크</Label>
                          <Input
                            value={shareUrl}
                            readOnly
                            className="mt-1"
                          />
                        </TextField>
                        <Button variant="secondary" onPress={handleCopy}>
                          {copied
                            ? (
                                <CheckIcon className="size-4" />
                              )
                            : (
                                <CopyIcon className="size-4" />
                              )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        만료일:
                        {' '}
                        {new Date(shareState.expiresAt).toLocaleDateString(
                          'ko-KR',
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  // 활성 공유 링크가 없는 경우
                  <div className="p-1 space-y-4">
                    {/* Checkbox.Content(클릭 영역)가 Control과 Label을 모두 감싸야 한다 — HeroUI v3 소스 주석 참조 */}
                    <Checkbox
                      isSelected={showPayments}
                      onChange={setShowPayments}
                      variant="secondary"
                    >
                      <Checkbox.Content>
                        <Checkbox.Control className="size-5">
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label>결제 정보 표시 (다음 결제 예정일 · 납부 상태)</Label>
                      </Checkbox.Content>
                    </Checkbox>

                    <Button
                      variant="primary"
                      className="w-full"
                      onPress={handleCreateShare}
                      isPending={isLoading}
                    >
                      <LinkIcon className="size-4 mr-1" />
                      공유 링크 생성
                    </Button>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                {shareState && (
                  <Button
                    variant="danger-soft"
                    onPress={handleRevokeShare}
                    isDisabled={isLoading}
                  >
                    공유 중지
                  </Button>
                )}
                <div className="grow" />
                <Button variant="ghost" onPress={close}>
                  닫기
                </Button>
              </Modal.Footer>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
