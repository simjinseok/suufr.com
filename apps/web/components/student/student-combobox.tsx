'use client';
import type { ComboBoxProps } from '@heroui/react';
import type { Student } from '@/types/index';

import {
  Collection,
  ComboBox,
  EmptyState,
  Input,
  Label,
  ListBox,
  ListBoxLoadMoreItem,
  Spinner,
} from '@heroui/react';
import { useAsyncList } from '@react-stately/data';

interface Props extends Pick<ComboBoxProps<Student>, 'name' | 'selectedKey' | 'defaultInputValue' | 'defaultSelectedKey'> {
  label?: string;
  onSelect: (studentId: Student['id']) => void;
  placeholder?: string;
}
export function StudentComboBox(props: Props) {
  const { name, selectedKey, onSelect, defaultInputValue, defaultSelectedKey, label, placeholder } = props;
  const list = useAsyncList<Student>({
    async load({ cursor, filterText, signal }) {
      if (cursor) {
        cursor = cursor.replace(/^http:\/\//i, 'https://');
      }
      const res = await fetch(cursor || `/api/students?search=${filterText}`, {
        signal,
      });
      const json = await res.json();
      return {
        cursor: json.next,
        items: json.items,
      };
    },
    initialFilterText: defaultInputValue,
  });

  return (
    <ComboBox
      inputValue={list.filterText}
      onInputChange={list.setFilterText}
      // onInputChange={(value) => {
      //   if (!value) {
      //     return;
      //   }
      //   list.setFilterText(value);
      // }}
      name={name}
      defaultInputValue={defaultInputValue}
      defaultSelectedKey={defaultSelectedKey}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key === null) {
          onSelect?.('');
          return;
        }
        onSelect?.(Number(key));
        // 선택된 항목의 name을 input에 표시
        const selectedItem = list.items.find(item => item.id === key);
        if (selectedItem) {
          list.setFilterText(selectedItem.name);
        }
      }}
    >
      {label && (
        <Label>{label}</Label>
      )}
      <ComboBox.InputGroup>
        <Input
          placeholder={placeholder}
        />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox renderEmptyState={() => <EmptyState />}>
          <Collection items={list.items}>
            {item => (
              <ListBox.Item
                id={item.id}
                textValue={item.name}
              >
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </Collection>
          <ListBoxLoadMoreItem
            isLoading={list.loadingState === 'loadingMore'}
            onLoadMore={list.loadMore}
          >
            <div className="flex items-center justify-center gap-2 py-2">
              <Spinner size="sm" />
              <span className="muted text-sm">Loading more...</span>
            </div>
          </ListBoxLoadMoreItem>
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
