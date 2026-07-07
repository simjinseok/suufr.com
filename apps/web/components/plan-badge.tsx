type Props = {
  plan: 'free' | 'pro';
};

export function PlanBadge({ plan }: Props) {
  const isPro = plan === 'pro';

  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
        isPro ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {isPro ? 'PRO' : 'FREE'}
    </span>
  );
}
