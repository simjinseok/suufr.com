import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { invoicesApi } from '@/utils/api';

// 입금 모달의 "연결된 수강권" 선택용 프록시 — 학생의 수강권 목록 (모달 오픈 시 호출)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.organization) {
    return NextResponse.json(
      { message: '인증이 필요합니다.' },
      { status: 401 },
    );
  }

  const studentUuid = request.nextUrl.searchParams.get('studentUuid');
  if (!studentUuid) {
    return NextResponse.json(
      { message: 'studentUuid가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    const { data } = await invoicesApi.list({
      organizationUuids: [session.organization.uuid],
      studentUuid,
      limit: 100,
    });

    return NextResponse.json({
      data: data.map(invoice => ({
        uuid: invoice.uuid,
        title: invoice.title,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        price: invoice.price,
      })),
    });
  }
  catch {
    return NextResponse.json(
      { message: '수강권 목록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
