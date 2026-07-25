import { paymentsApi } from '@/utils/api/payments';
import { studentsApi } from '@/utils/api';
import PaymentsTable from './_payments-table';

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const { studentUuid } = await params;

  const [paymentsResponse, statsResponse] = await Promise.all([
    paymentsApi.list({ studentUuid, limit: 100 }),
    studentsApi.getStats(studentUuid),
  ]);

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
      payments={payments}
      outstandingAmount={statsResponse.data.outstandingAmount}
    />
  );
}
