'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { PrinterIcon } from 'lucide-react';
import type { TCurriculum, TCurriculumItem } from '@/types/index';

interface Props {
  curriculum: TCurriculum;
  organization: { name: string; phone: string | null; address: string | null };
}

// 시안 "프린트 1(명조 문서)". 첨부 파일·집계 숫자는 표시하지 않는다(스펙 R15·R16). 다크 모드와 무관하게 흰 종이.
export default function PrintView({ curriculum, organization }: Props) {
  return (
    <div className="mx-auto max-w-[794px] px-4 py-6 print:p-0">
      {/* 화면에서만 보이는 인쇄 버튼 */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          <PrinterIcon className="size-4" />
          인쇄
        </Button>
      </div>

      <article className="print-sheet bg-white rounded-sm shadow-[0_1px_2px_rgba(0,0,0,.06),0_8px_24px_rgba(0,0,0,.05)] px-[68px] py-[64px] text-zinc-900">
        <header className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="font-[family-name:var(--font-myeongjo)] text-[40px] font-extrabold leading-[1.15] tracking-tight">
              {curriculum.title}
            </h1>
            {curriculum.description && (
              <p className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-700">
                <span aria-hidden>●</span>
                <span className="whitespace-pre-wrap">{curriculum.description}</span>
              </p>
            )}
          </div>
          <div className="shrink-0 max-w-[45%] pt-1 text-right text-[11px] leading-[1.7] text-zinc-700 break-keep">
            <div className="text-xs font-bold text-zinc-900">{organization.name}</div>
            {organization.address && <div>{organization.address}</div>}
            {organization.phone && <div>{organization.phone}</div>}
          </div>
        </header>

        <hr className="my-7 border-0 h-px bg-zinc-900" />

        {curriculum.items.length > 0 && (
          <div className="space-y-3.5 mb-7">
            {curriculum.items.map(item => <PrintItem key={item.uuid} item={item} />)}
          </div>
        )}

        {/* 페이지 나눔 제어(break-after/inside)는 flex 안에서 불안정해 block + space-y 로 */}
        <div className="space-y-7">
          {curriculum.sections.map(section => (
            <section key={section.uuid} className="space-y-3">
              <div className="print-section-title flex items-baseline gap-2.5 pb-1.5 border-b border-zinc-300">
                <h2 className="font-[family-name:var(--font-myeongjo)] text-[22px] font-extrabold">{section.title}</h2>
                {section.description && <span className="text-xs text-zinc-500">{section.description}</span>}
              </div>
              <div className="space-y-3 pl-1">
                {section.items.map(item => <PrintItem key={item.uuid} item={item} />)}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 pt-3 border-t border-zinc-100 text-[10px] text-zinc-400">
          {organization.name}
          {' · '}
          {curriculum.title}
        </footer>
      </article>
    </div>
  );
}

function PrintItem({ item }: { item: TCurriculumItem }) {
  return (
    <div className="print-item space-y-0.5">
      <div className="text-sm font-bold">{item.title}</div>
      {item.description && (
        <div className="text-xs leading-relaxed text-zinc-600 whitespace-pre-wrap">{item.description}</div>
      )}
    </div>
  );
}
