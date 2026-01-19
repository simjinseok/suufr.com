'use client';
import * as React from 'react';
import { Tabs } from '@heroui/react';

type Props = {
  timeline: React.ReactNode;
  lessons: React.ReactNode;
  payments: React.ReactNode;
};

export default function StudentTabs({ comments, lessons, payments }: Props) {
  return (
    <Tabs>
      <Tabs.ListContainer>
        <Tabs.List>
          <Tabs.Tab id="lessons">
            레슨
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="payments">
            결제내역
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="comments">
            코멘트
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>

      <Tabs.Panel id="lessons">{lessons}</Tabs.Panel>
      <Tabs.Panel id="comments">{comments}</Tabs.Panel>
      <Tabs.Panel id="payments">{payments}</Tabs.Panel>
    </Tabs>
  );
}
