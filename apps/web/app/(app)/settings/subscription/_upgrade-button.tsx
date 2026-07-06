'use client';

import * as React from 'react';
import { Button, Modal } from '@heroui/react';
import { Crown } from 'lucide-react';

interface UpgradeButtonProps {
  priceKrw: number;
}

export default function UpgradeButton({ priceKrw }: UpgradeButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <React.Fragment>
      <Button variant="primary" size="sm" onPress={() => setIsOpen(true)}>
        <Crown className="w-4 h-4" />
        프로로 업그레이드
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Container className="max-w-sm">
          <Modal.Dialog>
            {({ close }) => (
              <React.Fragment>
                <Modal.Header>
                  <Modal.Heading className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-indigo-600" />
                    프로 플랜
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p className="text-sm text-gray-600">
                    프로 플랜(월 {priceKrw.toLocaleString('ko-KR')}원) 정기결제를 준비하고 있어요.
                    곧 이용할 수 있습니다.
                  </p>
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
    </React.Fragment>
  );
}
