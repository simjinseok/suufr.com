'use client';
import React from 'react';
import { Label, ListBox, Select } from '@heroui/react';
import type { TCurriculumSection } from '@/types/index';

interface Props {
  sections: Pick<TCurriculumSection, 'uuid' | 'title'>[];
  name?: string;
  defaultValue?: string; // '' 또는 NO_SECTION = 섹션 없음
  isDisabled?: boolean;
  className?: string;
}

/** 폼 값으로 쓰는 "섹션 없음" 표식. react-aria Select 는 빈 문자열 키를 "선택 없음"으로 다룰 수 있어 빈 값을 키로 쓰지 않는다. */
export const NO_SECTION = 'none';

/** 항목이 속할 섹션 하나를 고르는 Select. 첫 선택지는 항상 "섹션 없음"(값 NO_SECTION). */
export default function SectionSelect({ sections, name = 'sectionUuid', defaultValue = '', isDisabled, className }: Props) {
  return (
    <Select variant="secondary" name={name} defaultValue={defaultValue || NO_SECTION} isDisabled={isDisabled} className={className}>
      <Label>섹션</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id={NO_SECTION}>섹션 없음</ListBox.Item>
          {sections.map(section => (
            <ListBox.Item key={section.uuid} id={section.uuid}>{section.title}</ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
