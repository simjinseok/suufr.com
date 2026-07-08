'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner, toast } from '@heroui/react';
import { Crown } from 'lucide-react';
import { initializePaddle, CheckoutEventNames, type Paddle } from '@paddle/paddle-js';

import { getSubscription } from '@/actions/subscription';

/** 서버 컴포넌트가 런타임 env에서 읽어 내려주는 Paddle 체크아웃 설정 */
export interface PaddleCheckoutConfig {
  clientToken: string;
  environment: 'sandbox' | 'production';
  priceIdPro: string;
}

interface UpgradeButtonProps {
  userId: string;
  customerEmail?: string;
  paddle: PaddleCheckoutConfig | null;
}

// 결제 완료 후 webhook 반영 대기 폴링 간격/횟수 (2초 x 15회 = 최대 30초)
const CONFIRM_POLL_INTERVAL_MS = 2000;
const CONFIRM_POLL_MAX_ATTEMPTS = 15;

export default function UpgradeButton({ userId, customerEmail, paddle }: UpgradeButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const paddleRef = React.useRef<Paddle | null>(null);

  // 결제 직후에는 webhook이 아직 도착하지 않았을 수 있어 pro 전환을 폴링으로 확인
  const confirmUpgrade = React.useCallback(async () => {
    setIsConfirming(true);
    try {
      for (let attempt = 0; attempt < CONFIRM_POLL_MAX_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, CONFIRM_POLL_INTERVAL_MS));
        const subscription = await getSubscription();
        if (subscription?.plan === 'pro') {
          toast.success('프로 플랜이 활성화되었어요!', {
            description: '이제 수강생을 제한 없이 등록할 수 있어요.',
            timeout: 5000,
          });
          router.refresh();
          return;
        }
      }
      toast.success('결제가 접수되었어요.', {
        description: '곧 프로 플랜이 활성화됩니다. 잠시 후 새로고침해주세요.',
        timeout: 5000,
      });
      router.refresh();
    }
    finally {
      setIsConfirming(false);
    }
  }, [router]);

  const handleUpgrade = async () => {
    if (!paddle) {
      toast.danger('결제 설정 오류', {
        description: '결제 설정이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.',
        timeout: 3000,
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!paddleRef.current) {
        paddleRef.current = await initializePaddle({
          token: paddle.clientToken,
          environment: paddle.environment,
          eventCallback: (event) => {
            if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
              void confirmUpgrade();
            }
          },
        }) ?? null;
      }

      if (!paddleRef.current) {
        throw new Error('결제 모듈을 불러오지 못했습니다.');
      }

      paddleRef.current.Checkout.open({
        items: [{ priceId: paddle.priceIdPro, quantity: 1 }],
        ...(customerEmail && { customer: { email: customerEmail } }),
        customData: { userId },
        settings: {
          displayMode: 'overlay',
          locale: 'ko',
        },
      });
    }
    catch (error: any) {
      toast.danger('결제창 열기 실패', {
        description: error?.message || '결제창을 열지 못했습니다. 잠시 후 다시 시도해주세요.',
        timeout: 3000,
      });
    }
    finally {
      setIsLoading(false);
    }
  };

  if (isConfirming) {
    return (
      <Button variant="primary" size="sm" isDisabled>
        <Spinner color="current" size="sm" />
        결제 확인 중...
      </Button>
    );
  }

  return (
    <Button variant="primary" size="sm" onPress={handleUpgrade} isPending={isLoading}>
      {isLoading ? <Spinner color="current" size="sm" /> : <Crown className="w-4 h-4" />}
      프로로 업그레이드
    </Button>
  );
}
