'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Form, ListBox, Select } from '@heroui/react';

export default function ConditionForm({
  currentStatus,
}: { currentStatus: string }) {
  const router = useRouter();
  return (
    <Form method="get" className="flex">
      {/* <Input name="name" /> 검색 지원 예정 */}
      <Select
        className="w-28"
        name="status"
        aria-label="상태"
        value={currentStatus}
        onChange={(key) => {
          if (typeof key === 'string') {
            router.push(`/students?status=${key}`);
          }
        }}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="" textValue="전체">전체</ListBox.Item>
            <ListBox.Item id="active" textValue="수강중">수강중</ListBox.Item>
            <ListBox.Item id="paused" textValue="중단">중단</ListBox.Item>
            <ListBox.Item id="leave" textValue="그만둠">그만둠</ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </Form>
  );
}
