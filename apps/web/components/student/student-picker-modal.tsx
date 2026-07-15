'use client';

import * as React from 'react';
import {
  Button,
  InputGroup,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';

import StatusBadge from '@/components/status-badge';

type StudentRow = {
  uuid: string;
  name: string;
  status: 'active' | 'pending' | 'paused' | 'leave';
};

type Meta = {
  page: number;
  totalCount: number;
  totalPages: number;
};

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  onPick: (student: { uuid: string; name: string }) => void;
  // 필터 용도: 선택 해제("전체 수강생") 행을 노출
  onClear?: () => void;
  clearLabel?: string;
}

// 공용 수강생 선택 모달 — 이름 검색 + 상태 필터 + 페이지네이션 (/api/students 프록시 사용)
export default function StudentPickerModal({ isOpen, onOpenChange, heading, onPick, onClear, clearLabel = '전체 수강생' }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          {() => (
            <React.Fragment>
              <Modal.Header>
                <Modal.Heading>{heading}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Content onPick={onPick} onClear={onClear} clearLabel={clearLabel} />
              </Modal.Body>
            </React.Fragment>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Content({ onPick, onClear, clearLabel }: Pick<Props, 'onPick' | 'onClear' | 'clearLabel'>) {
  const [query, setQuery] = React.useState('');
  // 기본은 전체 — 대기중(pending) 수강생도 선택 대상이어야 한다
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);

  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // 검색어 디바운스
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (debouncedQuery) params.set('q', debouncedQuery);
        if (status) params.set('status', status);

        const response = await fetch(`/api/students?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('failed');

        const json = await response.json();
        setStudents(json.data);
        setMeta(json.meta);
        setIsLoading(false);
      }
      catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setStudents([]);
          setMeta(null);
          setIsLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [debouncedQuery, status, page]);

  return (
    <div className="p-1 flex flex-col gap-3">
      {/* 이름 검색 + 상태 필터 (같은 줄) */}
      <div className="flex gap-2">
        <TextField
          className="flex-1"
          aria-label="이름 검색"
          value={query}
          onChange={setQuery}
        >
          <InputGroup>
            <InputGroup.Prefix>
              <SearchIcon className="size-4 text-zinc-400" />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder="이름 검색" />
          </InputGroup>
        </TextField>
        <Select
          variant="secondary"
          className="w-32 shrink-0"
          aria-label="상태"
          selectedKey={status}
          onSelectionChange={(key) => {
            setStatus(key as string);
            setPage(1);
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
              <ListBox.Item id="paused" textValue="일시정지">일시정지</ListBox.Item>
              <ListBox.Item id="leave" textValue="그만둠">그만둠</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* 수강생 목록 */}
      <div className="min-h-56">
        {isLoading
          ? (
              <div className="h-56 flex items-center justify-center">
                <Spinner size="sm" />
              </div>
            )
          : (
              <ul>
                {onClear && (
                  <li>
                    <button
                      type="button"
                      className="w-full flex items-center px-3 py-2.5 rounded-lg text-left text-sm font-medium text-indigo-600 hover:bg-gray-50 cursor-pointer"
                      onClick={onClear}
                    >
                      {clearLabel}
                    </button>
                  </li>
                )}
                {students.length === 0
                  ? (
                      <li className="py-10 text-center text-sm text-gray-400">
                        수강생이 없습니다.
                      </li>
                    )
                  : students.map(student => (
                      <li key={student.uuid}>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 cursor-pointer"
                          onClick={() => onPick({ uuid: student.uuid, name: student.name })}
                        >
                          <span className="font-medium text-gray-900 truncate">{student.name}</span>
                          <StatusBadge status={student.status} size="sm" />
                        </button>
                      </li>
                    ))}
              </ul>
            )}
      </div>

      {/* 페이지네이션 */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            isDisabled={page <= 1}
            onPress={() => setPage(p => p - 1)}
          >
            <ChevronLeftIcon className="size-4" />
            이전
          </Button>
          <span className="text-sm text-gray-500 tabular-nums">
            {page}
            {' / '}
            {meta.totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            isDisabled={page >= meta.totalPages}
            onPress={() => setPage(p => p + 1)}
          >
            다음
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
