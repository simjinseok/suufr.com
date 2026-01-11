'use client';
import { Tabs } from '@heroui/react';

export default function Tab() {
  return (
    <Tabs>
      <Tabs.ListContainer>
        <Tabs.List>
          <Tabs.Tab id="overview">
            기본정보
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="syllabuses">
            계획
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="status">
            이력
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="payments">
            입금내역
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>

      </Tabs.ListContainer>
    </Tabs>
  );
}
