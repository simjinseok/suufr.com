import { invoicesApi } from '@/utils/api/invoices';
import { paymentsApi } from '@/utils/api/payments';
import { studentsApi } from '@/utils/api';
import PaymentsTable from './_payments-table';

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const { studentUuid } = await params;

  // 청구(수강권)와 입금은 서로 연결되지 않는다 — 잔액(미수/선납)은 서버 파생값 사용
  const [invoicesResponse, paymentsResponse, statsResponse] = await Promise.all([
    invoicesApi.list({ studentUuid, limit: 100 }),
    paymentsApi.list({ studentUuid, limit: 100 }),
    studentsApi.getStats(studentUuid),
  ]);

  const invoices = invoicesResponse.data.map(invoice => ({
    id: invoice.id,
    uuid: invoice.uuid,
    title: invoice.title,
    price: invoice.price,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
  }));

  const payments = paymentsResponse.data.map(payment => ({
    id: payment.id,
    uuid: payment.uuid,
    amount: payment.amount,
    method: payment.method,
    paidAt: new Date(payment.paidAt),
    notes: payment.notes,
  }));

  return (
    <PaymentsTable
      studentUuid={studentUuid}
      invoices={invoices}
      payments={payments}
      outstandingAmount={statsResponse.data.outstandingAmount}
      creditAmount={statsResponse.data.creditAmount}
    />
  );
}
