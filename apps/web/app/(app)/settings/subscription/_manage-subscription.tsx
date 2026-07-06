'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, toast } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';

import { cancelSubscription, resumeSubscription } from '@/actions/subscription';

interface CancelButtonProps {
  periodEndText: string;
}

export function CancelSubscriptionButton({ periodEndText }: CancelButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <React.Fragment>
      <Button variant="ghost" size="sm" className="text-gray-500" onPress={() => setIsOpen(true)}>
        구독 해지
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Container className="max-w-sm">
          <Modal.Dialog>
            {({ close }) => <CancelContent close={close} periodEndText={periodEndText} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </React.Fragment>
  );
}

function CancelContent({ close, periodEndText }: { close: () => void; periodEndText: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleCancel = async () => {
    setIsPending(true);
    const result = await cancelSubscription();

    if (result.success) {
      toast.success('구독이 해지되었습니다.', {
        description: `${periodEndText}까지 프로 플랜을 이용할 수 있어요.`,
        timeout: 4000,
      });
      router.refresh();
      close();
    }
    else {
      toast.danger('해지 실패', {
        description: result.message || '구독 해지에 실패했습니다.',
        timeout: 3000,
      });
    }
    setIsPending(false);
  };

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          구독 해지
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="text-sm text-gray-600 space-y-2">
          <p>프로 플랜 구독을 해지하시겠어요?</p>
          <p>
            해지해도 <span className="font-medium">{periodEndText}</span>까지 프로 플랜을 그대로
            이용할 수 있고, 이후 무료 플랜으로 전환됩니다. 기간 내에는 언제든 해지를 취소할 수 있어요.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close} isDisabled={isPending}>
          닫기
        </Button>
        <Button variant="danger" onPress={handleCancel} isPending={isPending}>
          해지하기
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}

export function ResumeSubscriptionButton() {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleResume = async () => {
    setIsPending(true);
    const result = await resumeSubscription();

    if (result.success) {
      toast.success('해지가 취소되었습니다.', {
        description: '구독이 계속 유지됩니다.',
        timeout: 3000,
      });
      router.refresh();
    }
    else {
      toast.danger('해지 취소 실패', {
        description: result.message || '해지 취소에 실패했습니다.',
        timeout: 3000,
      });
    }
    setIsPending(false);
  };

  return (
    <Button variant="primary" size="sm" onPress={handleResume} isPending={isPending}>
      해지 취소
    </Button>
  );
}
