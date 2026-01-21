import { lessonsApi } from '@/utils/api/lessons';
import PaymentsTable from './_payments-table';

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ studentUuid: string }>;
}) {
  const { studentUuid } = await params;

  const response = await lessonsApi.list({ studentUuid, limit: 1000 });

  const lessons = response.data.map(lesson => ({
    id: lesson.id,
    uuid: lesson.uuid,
    title: lesson.title,
    createdAt: new Date(lesson.sessions[0]?.sessionAt || Date.now()),
    payment: lesson.payment && lesson.payment.paidAt
      ? {
          id: lesson.payment.id,
          uuid: lesson.payment.uuid,
          amount: lesson.payment.amount,
          paymentMethod: lesson.payment.paymentMethod,
          paidAt: new Date(lesson.payment.paidAt),
          notes: lesson.payment.notes,
        }
      : null,
  }));

  return <PaymentsTable lessons={lessons} />;
}
