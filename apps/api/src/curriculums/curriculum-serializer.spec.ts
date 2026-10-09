import { CURRICULUM_INCLUDE, serializeCurriculum, serializeItem } from './curriculum-serializer';

const item = (id: number, sectionUuid: string | null) => ({
  id, uuid: `i${id}`, title: `${id}회차`, description: null, sortOrder: 0,
  curriculumId: 1, sectionId: sectionUuid ? 7 : null,
  section: sectionUuid ? { uuid: sectionUuid } : null,
  mediaFiles: [],
});

describe('serializeItem', () => {
  it('section 관계를 sectionUuid 로 바꾼다', () => {
    const out = serializeItem(item(1, 's1') as any);
    expect(out.sectionUuid).toBe('s1');
    expect('section' in out).toBe(false);
  });
  it('섹션 없으면 null', () => {
    expect(serializeItem(item(2, null) as any).sectionUuid).toBeNull();
  });
});

describe('CURRICULUM_INCLUDE 정렬 키', () => {
  it('항목·섹션 모두 sortOrder, id 순 (제목 정렬 아님 — 같은 제목이 많아도 결정적)', () => {
    expect(CURRICULUM_INCLUDE.items.orderBy).toEqual([{ sortOrder: 'asc' }, { id: 'asc' }]);
    expect(CURRICULUM_INCLUDE.sections.orderBy).toEqual([{ sortOrder: 'asc' }, { id: 'asc' }]);
    expect(CURRICULUM_INCLUDE.sections.include.items.orderBy).toEqual([{ sortOrder: 'asc' }, { id: 'asc' }]);
    expect(CURRICULUM_INCLUDE.items.where).toEqual({ deletedAt: null, sectionId: null });
  });
  it('소유 조직의 상호·연락처·주소를 함께 내려준다 (프린트 헤더는 세션 조직이 아니라 소유 조직)', () => {
    expect(CURRICULUM_INCLUDE.organization).toEqual({ select: { uuid: true, name: true, phone: true, address: true } });
  });
  it('삭제된 섹션과 섹션 안의 삭제된 항목은 내려주지 않는다', () => {
    expect(CURRICULUM_INCLUDE.sections.where).toEqual({ deletedAt: null });
    expect(CURRICULUM_INCLUDE.sections.include.items.where).toEqual({ deletedAt: null });
  });
});

describe('serializeCurriculum', () => {
  it('섹션 없는 items 와 sections[].items 를 모두 직렬화한다', () => {
    const out = serializeCurriculum({
      id: 1, uuid: 'c1', title: 't', description: null,
      items: [item(1, null)],
      sections: [{ id: 7, uuid: 's1', title: '1개월차', description: null, sortOrder: 0, items: [item(2, 's1')] }],
    } as any);
    expect(out.items[0].sectionUuid).toBeNull();
    expect(out.sections[0].items[0].sectionUuid).toBe('s1');
    expect('section' in out.sections[0].items[0]).toBe(false);
  });
});
