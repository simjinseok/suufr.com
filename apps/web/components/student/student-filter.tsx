'use client';

import * as React from 'react';
import { Button } from '@heroui/react';
import { ChevronDownIcon, UserRoundIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import StudentPickerModal from '@/components/student/student-picker-modal';

type Props = {
  // URL의 student 파라미터로 선택된 수강생 (없으면 전체)
  selected: { uuid: string; name: string } | null;
};

// URL의 student 쿼리 파라미터로 목록을 필터링하는 수강생 선택 버튼 (공용 선택 모달 사용)
export function StudentFilter({ selected }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = React.useState(false);

  const apply = (studentUuid: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (studentUuid) {
      params.set('student', studentUuid);
    }
    else {
      params.delete('student');
    }
    // 필터가 바뀌면 첫 페이지부터
    params.delete('page');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setIsOpen(false);
  };

  return (
    <React.Fragment>
      <Button variant="secondary" size="sm" onPress={() => setIsOpen(true)}>
        <UserRoundIcon className="size-4" />
        {selected ? selected.name : '전체 수강생'}
        <ChevronDownIcon className="size-4 text-gray-400" />
      </Button>
      <StudentPickerModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        heading="수강생 필터"
        onPick={student => apply(student.uuid)}
        onClear={() => apply(null)}
        clearLabel="전체 수강생"
      />
    </React.Fragment>
  );
}
