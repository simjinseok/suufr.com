'use client';

import React from 'react';
import Link from 'next/link';
import { Button, Modal, Surface } from '@heroui/react';
import { ChevronLeftIcon, ImageIcon, PrinterIcon, VideoIcon } from 'lucide-react';
import CreateItemModal from '@/components/curriculum/create-item-modal';
import CreateSectionModal from '@/components/curriculum/create-section-modal';
import EditCurriculumModal from '@/components/curriculum/edit-curriculum-modal';
import ItemMenu from '@/components/curriculum/item-menu';
import SectionMenu from '@/components/curriculum/section-menu';
import type { TCurriculum, TCurriculumItem, TCurriculumSection } from '@/types/index';

interface Props {
  curriculum: TCurriculum;
}

// 섹션 없는 항목 → 섹션들(각각 섹션 줄 + 항목) 순. 집계 숫자·빈 섹션 안내 문구는 두지 않는다(스펙 R11).
export default function Curriculum({ curriculum }: Props) {
  const sections = curriculum.sections;
  const sectionOptions = sections.map(s => ({ uuid: s.uuid, title: s.title }));
  const isEmpty = curriculum.items.length === 0 && sections.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Link href="/curriculums">
            <Button variant="ghost" size="sm" isIconOnly>
              <ChevronLeftIcon className="size-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{curriculum.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Modal>
            <Button variant="secondary" size="sm">수정</Button>
            <EditCurriculumModal curriculum={curriculum} />
          </Modal>
          <Link href={`/curriculums/${curriculum.uuid}/print`} target="_blank" rel="noopener">
            <Button variant="secondary" size="sm">
              <PrinterIcon className="size-4" />
              인쇄
            </Button>
          </Link>
        </div>
      </div>

      {curriculum.description && (
        <p className="text-zinc-500 mb-4">{curriculum.description}</p>
      )}

      <div className="flex justify-end items-center gap-2 mb-4">
        <Modal>
          <Button variant="secondary" size="sm">섹션 추가</Button>
          <CreateSectionModal curriculumUuid={curriculum.uuid} />
        </Modal>
        <Modal>
          <Button variant="secondary" size="sm">항목 추가</Button>
          <CreateItemModal curriculumUuid={curriculum.uuid} sections={sectionOptions} />
        </Modal>
      </div>

      {isEmpty
        ? (
            <Surface className="p-8 rounded-xl text-center text-zinc-500" variant="secondary">
              아직 항목이 없어요
            </Surface>
          )
        : (
            <div className="space-y-2">
              {/* 섹션 없는 항목: 묶음 제목 없이 맨 위 */}
              {curriculum.items.map((item, index) => (
                <ItemCard
                  key={item.uuid}
                  item={item}
                  sections={sectionOptions}
                  curriculumUuid={curriculum.uuid}
                  isFirst={index === 0}
                  isLast={index === curriculum.items.length - 1}
                />
              ))}

              {sections.map((section, sectionIndex) => (
                <SectionBlock
                  key={section.uuid}
                  section={section}
                  sectionOptions={sectionOptions}
                  curriculumUuid={curriculum.uuid}
                  isFirst={sectionIndex === 0}
                  isLast={sectionIndex === sections.length - 1}
                />
              ))}
            </div>
          )}
    </div>
  );
}

interface SectionBlockProps {
  section: TCurriculumSection;
  sectionOptions: Pick<TCurriculumSection, 'uuid' | 'title'>[];
  curriculumUuid: string;
  isFirst: boolean;
  isLast: boolean;
}

function SectionBlock({ section, sectionOptions, curriculumUuid, isFirst, isLast }: SectionBlockProps) {
  return (
    <React.Fragment>
      {/* 섹션 줄: 카드가 아니라 텍스트 줄 (시안 "관리 1") */}
      <div className="flex items-center gap-3 pt-5 pb-1.5 px-1">
        <div className="flex-1 min-w-0 flex items-baseline gap-2.5">
          <span className="text-base font-semibold">{section.title}</span>
          {section.description && (
            <span className="text-xs text-zinc-500 truncate">{section.description}</span>
          )}
        </div>
        <SectionMenu section={section} curriculumUuid={curriculumUuid} isFirst={isFirst} isLast={isLast} />
      </div>

      {section.items.length === 0
        ? (
            <Modal>
              <Button
                variant="ghost"
                className="ml-4 w-[calc(100%-1rem)] h-11 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-sm text-zinc-500"
              >
                + 이 섹션에 항목 추가
              </Button>
              <CreateItemModal curriculumUuid={curriculumUuid} sections={sectionOptions} defaultSectionUuid={section.uuid} />
            </Modal>
          )
        : (
            section.items.map((item, index) => (
              <div key={item.uuid} className="ml-4">
                <ItemCard
                  item={item}
                  sections={sectionOptions}
                  curriculumUuid={curriculumUuid}
                  isFirst={index === 0}
                  isLast={index === section.items.length - 1}
                />
              </div>
            ))
          )}
    </React.Fragment>
  );
}

interface ItemCardProps {
  item: TCurriculumItem;
  sections: Pick<TCurriculumSection, 'uuid' | 'title'>[];
  curriculumUuid: string;
  isFirst: boolean;
  isLast: boolean;
}

function ItemCard({ item, sections, curriculumUuid, isFirst, isLast }: ItemCardProps) {
  const mediaFiles = item.mediaFiles ?? [];

  return (
    <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{item.title}</h3>
          {item.description && (
            <p className="text-sm text-zinc-500 mt-1">{item.description}</p>
          )}

          {mediaFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {mediaFiles.map((mf) => (
                <div
                  key={mf.id}
                  className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-xs"
                >
                  {mf.mediaFile.type === 'video'
                    ? (
                        <VideoIcon className="size-3 text-zinc-400" />
                      )
                    : (
                        <ImageIcon className="size-3 text-zinc-400" />
                      )}
                  <span className="truncate max-w-24">
                    {mf.mediaFile.fileName || 'file'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <ItemMenu item={item} sections={sections} curriculumUuid={curriculumUuid} isFirst={isFirst} isLast={isLast} />
      </div>
    </div>
  );
}
