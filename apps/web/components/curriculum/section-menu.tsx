'use client';
import React from 'react';
import { Button, Dropdown } from '@heroui/react';
import { EllipsisIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { modal } from '@/contexts/modal-manager';
import { moveCurriculumSection, removeCurriculumSection } from '@/actions/curriculum';
import EditSectionModal from '@/components/curriculum/edit-section-modal';
import DeleteConfirmModal from '@/components/curriculum/delete-confirm-modal';
import type { TCurriculumSection } from '@/types/index';

interface Props {
  section: TCurriculumSection;
  curriculumUuid: string;
  isFirst: boolean;
  isLast: boolean;
}

/** 섹션 줄 오른쪽 ⋯ 메뉴. 수정 / 위로 / 아래로 / 삭제(항목은 섹션 없음으로 이동). */
export default function SectionMenu({ section, curriculumUuid, isFirst, isLast }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const move = (direction: 'up' | 'down') => {
    startTransition(async () => {
      await moveCurriculumSection({ uuid: section.uuid, curriculumUuid, direction });
      router.refresh();
    });
  };

  const disabledKeys = [
    ...(isFirst ? ['move-up'] : []),
    ...(isLast ? ['move-down'] : []),
  ];

  return (
    <Dropdown>
      <Button variant="ghost" size="sm" isIconOnly aria-label="섹션 메뉴" isDisabled={isPending}>
        <EllipsisIcon className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-40">
        <Dropdown.Menu
          selectionMode="none"
          disabledKeys={disabledKeys}
          onAction={(key) => {
            if (key === 'edit') {
              modal.show(EditSectionModal, { section, curriculumUuid });
            }
            else if (key === 'move-up') move('up');
            else if (key === 'move-down') move('down');
            else if (key === 'delete') {
              modal.show(DeleteConfirmModal, {
                heading: '섹션 삭제',
                message: `"${section.title}" 섹션만 삭제됩니다. 안의 항목은 섹션 없음으로 이동합니다.`,
                action: removeCurriculumSection,
                fields: { sectionUuid: section.uuid, curriculumUuid },
              });
            }
          }}
        >
          <Dropdown.Section>
            <Dropdown.Item id="edit">수정</Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Dropdown.Item id="move-up">위로 이동</Dropdown.Item>
            <Dropdown.Item id="move-down">아래로 이동</Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Dropdown.Item id="delete" variant="danger">삭제</Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
