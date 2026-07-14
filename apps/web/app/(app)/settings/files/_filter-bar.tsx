'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Select, ListBox, TextField, InputGroup } from '@heroui/react';
import { Search, X, FolderPlus } from 'lucide-react';

import CreateFolderModal from './_create-folder-modal';

interface NewFolderButtonProps {
  parentFolderUuid?: string;
}

export function NewFolderButton({ parentFolderUuid }: NewFolderButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button variant="secondary" onPress={() => setIsOpen(true)}>
        <FolderPlus className="w-4 h-4 mr-1" />
        새 폴더
      </Button>
      <CreateFolderModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        parentFolderUuid={parentFolderUuid}
      />
    </>
  );
}

interface FilterBarProps {
  sortOrder: 'newest' | 'oldest' | 'largest' | 'smallest';
  searchQuery: string;
  currentFolderUuid?: string;
}

const sortOptions = [
  { id: 'newest', label: '최신순' },
  { id: 'oldest', label: '오래된순' },
  { id: 'largest', label: '크기순 (큰순)' },
  { id: 'smallest', label: '크기순 (작은순)' },
];

export default function FilterBar({ sortOrder, searchQuery, currentFolderUuid }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [localSearch, setLocalSearch] = React.useState(searchQuery);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === '' || (key === 'sort' && value === 'newest')) {
      params.delete(key);
    }
    else {
      params.set(key, value);
    }
    // 폴더 유지
    if (currentFolderUuid && key !== 'folder') {
      params.set('folder', currentFolderUuid);
    }
    router.push(`/settings/files?${params.toString()}`);
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      updateParams('q', value);
    }, 300);
  };

  const clearSearch = () => {
    setLocalSearch('');
    updateParams('q', '');
  };

  return (
    <div className="flex items-center gap-2">
      <TextField
        aria-label="파일 검색"
        value={localSearch}
        onChange={handleSearchChange}
        className="flex-1"
      >
        <InputGroup>
          <InputGroup.Prefix>
            <Search className="w-4 h-4 text-gray-400" />
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="파일명으로 검색..." />
          {localSearch && (
            <InputGroup.Suffix>
              <button
                type="button"
                onClick={clearSearch}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </InputGroup.Suffix>
          )}
        </InputGroup>
      </TextField>

      <Select
        variant="secondary"
        aria-label="정렬 순서"
        selectedKey={sortOrder}
        onSelectionChange={(key) => updateParams('sort', key as string)}
        className="w-28 shrink-0"
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {sortOptions.map((option) => (
              <ListBox.Item key={option.id} id={option.id}>
                {option.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
