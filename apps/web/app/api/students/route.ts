import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { studentsApi } from '@/utils/api';

const PAGE_SIZE = 10;

// 수강생 선택 모달용 검색 프록시 — 이름(q)·상태 필터 + 페이지네이션
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.organization) {
    return NextResponse.json(
      { message: '인증이 필요합니다.' },
      { status: 401 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const status = searchParams.get('status') ?? '';
  const q = searchParams.get('q') ?? '';

  try {
    const { data, meta } = await studentsApi.list({
      organizationUuids: [session.organization.uuid],
      page,
      limit: PAGE_SIZE,
      status,
      q,
    });

    return NextResponse.json({
      data: data.map(student => ({
        uuid: student.uuid,
        name: student.name,
        status: student.status,
      })),
      meta,
    });
  }
  catch {
    return NextResponse.json(
      { message: '수강생 목록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
