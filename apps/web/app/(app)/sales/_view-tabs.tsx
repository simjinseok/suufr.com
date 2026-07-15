'use client';
import { Tabs } from '@heroui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PaymentView } from '@/types/index';

type Props = {
  view: PaymentView;
};

export default function ViewTabs({ view }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewChange = (newView: PaymentView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    params.delete('date');
    router.push(`/sales?${params.toString()}`);
  };

  return (
    <Tabs selectedKey={view}>
      <Tabs.ListContainer className="whitespace-nowrap">
        <Tabs.List>
          <Tabs.Tab
            id="monthly"
            onPress={() => handleViewChange('monthly')}
          >
            월별
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab
            id="yearly"
            onPress={() => handleViewChange('yearly')}
          >
            연도별
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
