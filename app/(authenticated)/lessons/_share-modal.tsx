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
import { CopyIcon, CheckIcon, LinkIcon, Trash2Icon } from 'lucide-react';
import type { TSyllabus } from '@/types/index';

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus: TSyllabus;
};

type ShareState = {
  hasActiveShare: boolean;
  share: {
    uuid: string;
    expiresAt: string;
    url: string;
  } | null;
};

export default function ShareModal({ isOpen, onOpenChange, syllabus }: Props) {
  console.log(syllabus);
  const [shareState, setShareState] = React.useState<ShareState | null>(syllabus?.shares?.[0]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [expireDays, setExpireDays] = React.useState(7);
  const [copied, setCopied] = React.useState(false);

  // 현재 공유 상태 조회
  // React.useEffect(() => {
  //   if (isOpen && syllabus?.id) {
  //     setIsLoading(true);
  //     fetch(`/api/syllabuses/${syllabus.id}/share`)
  //       .then((res) => res.json())
  //       .then((data) => {
  //         setShareState(data);
  //         setIsLoading(false);
  //       })
  //       .catch(() => setIsLoading(false));
  //   }
  // }, [isOpen, syllabus?.id]);

  // 공유 링크 생성
  const handleCreateShare = React.useCallback(async () => {
    setIsLoading(true);
    const formData = new FormData();
    formData.set('expireDays', String(expireDays));

    const response = await fetch(`/api/syllabuses/${syllabus.id}/share`, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      setShareState({
        hasActiveShare: true,
        share: data,
      });
    }
    setIsLoading(false);
  }, [syllabus.id, expireDays]);

  // 공유 링크 무효화
  const handleRevokeShare = React.useCallback(async () => {
    if (!confirm('공유 링크를 무효화하시겠습니까?')) return;

    setIsLoading(true);
    await fetch(`/api/syllabuses/${syllabus.id}/share`, {
      method: 'DELETE',
    });
    setShareState({ hasActiveShare: false, share: null });
    setIsLoading(false);
  }, [syllabus.id]);

  // 클립보드 복사
  const handleCopy = React.useCallback(async () => {
    if (shareState) {
      await navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_BASE_URL}/sl/${shareState.uuid}/`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareState]);

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
                      <Label className="text-xs text-gray-500">공유 링크</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <TextField className="flex-1">
                          <Input
                            value={`${process.env.NEXT_PUBLIC_BASE_URL}/sl/${shareState.uuid}/`}
                            readOnly
                            className="text-sm"
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

                    <Button
                      variant="danger-soft"
                      className="w-full"
                      onPress={handleRevokeShare}
                      isDisabled={isLoading}
                    >
                      <Trash2Icon className="size-4 mr-1" />
                      공유 중지
                    </Button>
                  </div>
                ) : (
                  // 활성 공유 링크가 없는 경우
                  <div className="space-y-4">
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
