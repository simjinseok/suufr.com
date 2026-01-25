'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, Input, TextField } from '@heroui/react';
import { SearchIcon } from 'lucide-react';

import CreateCurriculumModal from '@/components/curriculum/create-curriculum-modal';

interface Props {
  search?: string;
}

export default function Heading({ search }: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = React.useState(search ?? '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchValue.trim()) {
      params.set('search', searchValue.trim());
    }
    router.push(`/curriculums${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
      <h1 className="text-2xl font-bold">커리큘럼</h1>
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2">
          <TextField aria-label="검색">
            <Input
              variant="secondary"
              placeholder="제목 검색"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-40"
            />
          </TextField>
          <Button type="submit" variant="ghost" isIconOnly>
            <SearchIcon className="size-4" />
          </Button>
        </form>
        <Modal>
          <Button variant="secondary">추가</Button>
          <CreateCurriculumModal />
        </Modal>
      </div>
    </div>
  );
}
