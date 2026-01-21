'use client';

import * as React from 'react';
import {
  Button,
  Label,
  Modal,
  NumberField,
  TextField,
  Input,
} from '@heroui/react';
import { CopyIcon, CheckIcon, LinkIcon } from 'lucide-react';
import type { TLesson } from '@/types/index';
import { createLessonShare, deleteLessonShare } from '@/actions/lesson';

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: TLesson;
};

type ShareState = {
  shareId: string;
  expiresAt: string;
} | null;

export default function ShareModal({ isOpen, onOpenChange, lesson }: Props) {
  const activeShare = lesson?.shares?.[0];
  const [shareState, setShareState] = React.useState<ShareState>(
    activeShare ? { shareId: activeShare.shareId, expiresAt: activeShare.expiresAt.toString() } : null
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [expireDays, setExpireDays] = React.useState(60);
  const [copied, setCopied] = React.useState(false);

  // 공유 링크 생성
  const handleCreateShare = React.useCallback(async () => {
    setIsLoading(true);
    const formData = new FormData();
    formData.set('lessonUuid', lesson.uuid);
    formData.set('expireDays', String(expireDays));

    const result = await createLessonShare({ success: false, timestamp: 0 }, formData);

    if (result.success && result.shareId && result.expiresAt) {
      setShareState({ shareId: result.shareId, expiresAt: result.expiresAt });
    }
    setIsLoading(false);
  }, [lesson.uuid, expireDays]);

  // 공유 링크 무효화
  const handleRevokeShare = React.useCallback(async () => {
    if (!confirm('공유 링크를 무효화하시겠습니까?')) return;
    if (!shareState) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.set('lessonUuid', lesson.uuid);
    formData.set('shareId', shareState.shareId);

    await deleteLessonShare({ success: false, timestamp: 0 }, formData);
    setShareState(null);
    setIsLoading(false);
  }, [lesson.uuid, shareState]);

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
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>
                  레슨 공유
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-gray-600 mb-4">
                  학생에게 레슨 계획과 진행 상황을 공유할 수 있습니다.
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
                    <NumberField
                      value={expireDays}
                      minValue={1}
                      maxValue={120}
                      onChange={setExpireDays}
                    >
                      <Label>만료 기간 (일)</Label>
                      <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input className="w-16 text-center" />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                    </NumberField>

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
