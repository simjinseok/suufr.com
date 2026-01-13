'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, ListBox, Select } from '@heroui/react';
import { SearchIcon } from 'lucide-react';

export default function ConditionForm({
  currentStatus,
}: { currentStatus: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchValue) {
        params.set('q', searchValue);
      } else {
        params.delete('q');
      }
      params.delete('page');
      router.push(`/students?${params.toString()}`);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue]);

  return (
    <Form method="get" className="flex gap-2">
      <Input
        className="w-40"
        name="q"
        aria-label="이름 검색"
        placeholder="이름 검색"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        startContent={<SearchIcon className="size-4 text-zinc-400" />}
      />
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
