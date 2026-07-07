'use client';

import * as React from 'react';
import { Button, Spinner, toast } from '@heroui/react';
import { Crown } from 'lucide-react';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

interface UpgradeButtonProps {
  customerKey: string;
  customerEmail?: string;
  customerName?: string;
}

export default function UpgradeButton({ customerKey, customerEmail, customerName }: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const payment = tossPayments.payment({ customerKey });

      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/settings/subscription/billing/success`,
        failUrl: `${window.location.origin}/settings/subscription/billing/fail`,
        customerEmail,
        customerName,
      });
    }
    catch (error: any) {
      // 사용자가 카드 등록창을 닫은 경우는 무시
      if (error?.code !== 'USER_CANCEL') {
        toast.danger('카드 등록 실패', {
          description: error?.message || '카드 등록창을 열지 못했습니다.',
          timeout: 3000,
        });
      }
    }
    finally {
      setIsLoading(false);
    }
  };

  return (
    <Button variant="primary" size="sm" onPress={handleUpgrade} isPending={isLoading}>
      {isLoading ? <Spinner color="current" size="sm" /> : <Crown className="w-4 h-4" />}
      프로로 업그레이드
    </Button>
  );
}
