'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Form, Select, SelectItem } from '@heroui/react';

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
        defaultSelectedKeys={[currentStatus]}
        onSelectionChange={(keys) => {
          router.push(`/students?status=${keys.currentKey}`);
        }}
      >
        <SelectItem key="">전체</SelectItem>
        <SelectItem key="active">수강중</SelectItem>
        <SelectItem key="paused">중단</SelectItem>
        <SelectItem key="leave">그만둠</SelectItem>
      </Select>
    </Form>
  );
}
