import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/utils/auth';
import { curriculumsApi } from '@/utils/api';
import PrintView from './_print-view';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ curriculumUuid: string }>;
};

// 브라우저 인쇄 머리글과 "PDF로 저장" 파일명이 커리큘럼 제목이 되도록
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { curriculumUuid } = await params;
  try {
    const response = await curriculumsApi.get(curriculumUuid);
    return { title: response.data.title };
  }
  catch {
    return {};
  }
}

export default async function Page({ params }: Props) {
  const { curriculumUuid } = await params;

  const session = await getSession();
  if (!session?.organization) {
    notFound();
  }

  try {
    const response = await curriculumsApi.get(curriculumUuid);
    const curriculum = response.data;

    // 헤더의 상호·연락처·주소는 세션의 선택 조직이 아니라 커리큘럼 소유 조직(다중 조직 사용자)
    return <PrintView curriculum={curriculum} organization={curriculum.organization} />;
  }
  catch {
    notFound();
  }
}
