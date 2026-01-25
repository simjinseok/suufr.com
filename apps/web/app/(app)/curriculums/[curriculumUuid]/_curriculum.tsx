'use client';

import React from 'react';
import Link from 'next/link';
import { Button, Modal, Surface } from '@heroui/react';
import { ChevronLeftIcon, ImageIcon, VideoIcon } from 'lucide-react';
import CreateItemModal from '@/components/curriculum/create-item-modal';
import EditItemModal from '@/components/curriculum/edit-item-modal';
import EditCurriculumModal from '@/components/curriculum/edit-curriculum-modal';
import type { TCurriculum, TCurriculumItem } from '@/types/index';

interface Props {
  curriculum: TCurriculum;
}

export default function Curriculum({ curriculum }: Props) {
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
        <Modal>
          <Button variant="secondary" size="sm">수정</Button>
          <EditCurriculumModal curriculum={curriculum} />
        </Modal>
      </div>

      {curriculum.description && (
        <p className="text-zinc-500 mb-4">{curriculum.description}</p>
      )}

      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-zinc-500">{curriculum.items.length}개 항목</span>
        <Modal>
          <Button variant="secondary" size="sm">항목 추가</Button>
          <CreateItemModal curriculumUuid={curriculum.uuid} />
        </Modal>
      </div>

      {curriculum.items.length === 0 ? (
        <Surface className="p-8 rounded-xl text-center text-zinc-500" variant="secondary">
          아직 항목이 없어요
        </Surface>
      ) : (
        <div className="space-y-2">
          {curriculum.items.map((item) => (
            <ItemCard key={item.uuid} item={item} curriculumUuid={curriculum.uuid} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ItemCardProps {
  item: TCurriculumItem;
  curriculumUuid: string;
}

function ItemCard({ item, curriculumUuid }: ItemCardProps) {
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
                  {mf.mediaFile.type === 'video' ? (
                    <VideoIcon className="size-3 text-zinc-400" />
                  ) : (
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

        <Modal>
          <Button size="sm" variant="secondary">수정</Button>
          <EditItemModal item={item} curriculumUuid={curriculumUuid} />
        </Modal>
      </div>
    </div>
  );
}
