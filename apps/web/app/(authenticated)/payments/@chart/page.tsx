import { paymentsApi } from '@/utils/api/payments';
import PaymentChart from './_chart';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    view: string;
    date: string;
  }>;
};

function getLastYearRange() {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - 11);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;

  return { startYear, startMonth, endYear, endMonth };
}

function generateLast12Months() {
  const months: { year: number; month: number; label: string }[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: `${date.getMonth() + 1}월`,
    });
  }

  return months;
}

export default async function ChartPage({ searchParams }: Props) {
  const { view } = await searchParams;

  if (view !== 'yearly') {
    return null;
  }

  const { startYear, startMonth, endYear, endMonth } = getLastYearRange();

  const startResponse = await paymentsApi.list({
    year: startYear,
    limit: 1000,
  });

  let allPayments = [...startResponse.data];

  if (startYear !== endYear) {
    const endResponse = await paymentsApi.list({
      year: endYear,
      limit: 1000,
    });
    allPayments = [...allPayments, ...endResponse.data];
  }

  const last12Months = generateLast12Months();

  const chartData = last12Months.map(({ year, month, label }) => {
    const monthPayments = allPayments.filter((p) => {
      const paidAt = new Date(p.paidAt);
      return paidAt.getFullYear() === year && paidAt.getMonth() + 1 === month;
    });

    const totalAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const count = monthPayments.length;

    return {
      label,
      year,
      month,
      totalAmount,
      count,
    };
  });

  return <PaymentChart data={chartData} />;
}
