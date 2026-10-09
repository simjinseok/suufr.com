import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { getSession } from '@/utils/auth';
import { invoicesApi, paymentsApi, sessionsApi } from '@/utils/api';

// 수강생 삭제 확인 모달용 프록시 — 함께 사라질 수업·수강권·결제 건수 (모달 오픈 시 호출)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentUuid: string }> },
) {
  const session = await getSession();
  if (!session?.organization) {
    return NextResponse.json(
      { message: '인증이 필요합니다.' },
      { status: 401 },
    );
  }

  const { studentUuid } = await params;
  const listParams = {
    organizationUuids: [session.organization.uuid],
    studentUuid,
    limit: 1,
  };

  try {
    const [sessions, invoices, payments] = await Promise.all([
      sessionsApi.list(listParams),
      invoicesApi.list(listParams),
      paymentsApi.list(listParams),
    ]);

    return NextResponse.json({
      data: {
        sessionCount: sessions.meta.totalCount,
        invoiceCount: invoices.meta.totalCount,
        paymentCount: payments.meta.totalCount,
      },
    });
  }
  catch {
    return NextResponse.json(
      { message: '수강생 기록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
