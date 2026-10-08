'use client';
import React from 'react';
import { Button, Dropdown, Separator } from '@heroui/react';
import { EllipsisVerticalIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { modal } from '@/contexts/modal-manager';
import { moveCurriculumItem, removeCurriculumItem } from '@/actions/curriculum';
import EditItemModal from '@/components/curriculum/edit-item-modal';
import MoveItemSectionModal from '@/components/curriculum/move-item-section-modal';
import DeleteConfirmModal from '@/components/curriculum/delete-confirm-modal';
import type { TCurriculumItem, TCurriculumSection } from '@/types/index';

interface Props {
  item: TCurriculumItem;
  sections: Pick<TCurriculumSection, 'uuid' | 'title'>[];
  curriculumUuid: string;
  isFirst: boolean;
  isLast: boolean;
}

/** 항목 카드 오른쪽 ⋮ 메뉴. 수정 / 위로 / 아래로 / 다른 섹션으로 이동(섹션 있을 때만) / 삭제. */
export default function ItemMenu({ item, sections, curriculumUuid, isFirst, isLast }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const move = (direction: 'up' | 'down') => {
    startTransition(async () => {
      await moveCurriculumItem({ uuid: item.uuid, curriculumUuid, direction });
      router.refresh();
    });
  };

  const disabledKeys = [
    ...(isFirst ? ['move-up'] : []),
    ...(isLast ? ['move-down'] : []),
  ];

  return (
    <Dropdown>
      <Button variant="ghost" size="sm" isIconOnly aria-label="항목 메뉴" isDisabled={isPending}>
        <EllipsisVerticalIcon className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-40">
        <Dropdown.Menu
          selectionMode="none"
          disabledKeys={disabledKeys}
          onAction={(key) => {
            if (key === 'edit') {
              modal.show(EditItemModal, { item, curriculumUuid, sections });
            }
            else if (key === 'move-up') move('up');
            else if (key === 'move-down') move('down');
            else if (key === 'move-section') {
              modal.show(MoveItemSectionModal, { item, sections, curriculumUuid });
            }
            else if (key === 'delete') {
              modal.show(DeleteConfirmModal, {
                heading: '항목 삭제',
                message: `"${item.title}" 항목을 삭제합니다.`,
                action: removeCurriculumItem,
                fields: { itemUuid: item.uuid, curriculumUuid },
              });
            }
          }}
        >
          <Dropdown.Item id="edit">수정</Dropdown.Item>
          <Separator />
          <Dropdown.Item id="move-up">위로 이동</Dropdown.Item>
          <Dropdown.Item id="move-down">아래로 이동</Dropdown.Item>
          {sections.length > 0 && <Dropdown.Item id="move-section">다른 섹션으로 이동</Dropdown.Item>}
          <Separator />
          <Dropdown.Item id="delete" variant="danger" className="text-danger" textValue="삭제">
            <Trash2Icon className="size-4" />
            삭제
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
