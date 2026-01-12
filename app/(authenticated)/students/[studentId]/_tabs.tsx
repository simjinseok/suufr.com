'use client';
import * as React from 'react';
import { Tabs } from '@heroui/react';

type Props = {
  timeline: React.ReactNode;
  lessons: React.ReactNode;
  payments: React.ReactNode;
};

export default function StudentTabs({ timeline, lessons, payments }: Props) {
  return (
    <Tabs>
      <Tabs.ListContainer>
        <Tabs.List>
          <Tabs.Tab id="timeline">
            타임라인
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="lessons">
            수업내역
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="payments">
            입금내역
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>

      <Tabs.Panel id="timeline">{timeline}</Tabs.Panel>

      <Tabs.Panel id="lessons">{lessons}</Tabs.Panel>

      <Tabs.Panel id="payments">{payments}</Tabs.Panel>
    </Tabs>
  );
}
