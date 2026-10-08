import { Prisma } from '@prisma/generated/client';

export const ITEM_INCLUDE = {
  mediaFiles: {
    orderBy: { createdAt: 'asc' as const },
    include: { mediaFile: true },
  },
  section: { select: { uuid: true } },
} satisfies Prisma.CurriculumItemInclude;

// 리포 관례(invoices.service.ts)대로 'asc' as const
const ITEM_ORDER = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

// 섹션 없는 항목은 items 로, 섹션 안 항목은 sections[].items 로. 둘 다 sortOrder, id 순.
export const CURRICULUM_INCLUDE = {
  // 프린트 헤더용 소유 조직 정보. 세션의 선택 조직이 아니라 커리큘럼이 속한 조직이어야 한다(다중 조직 사용자).
  organization: { select: { uuid: true, name: true, phone: true, address: true } },
  items: {
    where: { deletedAt: null, sectionId: null },
    orderBy: ITEM_ORDER,
    include: ITEM_INCLUDE,
  },
  sections: {
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    include: {
      items: {
        where: { deletedAt: null },
        orderBy: ITEM_ORDER,
        include: ITEM_INCLUDE,
      },
    },
  },
} satisfies Prisma.CurriculumInclude;

type ItemRow = Prisma.CurriculumItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
type CurriculumRow = Prisma.CurriculumGetPayload<{ include: typeof CURRICULUM_INCLUDE }>;

/** 응답에는 section 관계 대신 sectionUuid 만 내보낸다. */
export function serializeItem(item: ItemRow) {
  const { section, ...rest } = item;
  return { ...rest, sectionUuid: section?.uuid ?? null };
}

export function serializeCurriculum(curriculum: CurriculumRow) {
  return {
    ...curriculum,
    items: curriculum.items.map(serializeItem),
    sections: curriculum.sections.map(section => ({
      ...section,
      items: section.items.map(serializeItem),
    })),
  };
}
