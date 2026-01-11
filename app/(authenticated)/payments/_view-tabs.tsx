'use client';
import { Tabs } from '@heroui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { PaymentView } from '@/types/index';
import {
  getMonthRange,
  getYearRange,
  getPrevMonth,
  getNextMonth,
  getPrevYear,
  getNextYear,
} from '@/utils/payment-stats';

type Props = {
  view: PaymentView;
  date: string | undefined;
};

export default function ViewTabs({ view, date }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewChange = (newView: PaymentView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', newView);
    params.delete('date');
    router.push(`/payments?${params.toString()}`);
  };

  const { from } = view === 'monthly' ? getMonthRange(date) : getYearRange(date);

  return (
    <Tabs selectedKey={view}>
      <Tabs.ListContainer>
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
