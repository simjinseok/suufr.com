/** 랜딩 섹션들이 함께 쓰는 폭 클래스 */
export const WRAP = 'max-w-[1080px] mx-auto px-6';

/** 랜딩 섹션 제목 공통 클래스 */
export const H2 = 'text-brand-navy text-[clamp(26px,3.2vw,38px)] font-[750] tracking-[-0.03em] leading-[1.28]';

const TAG_TONE = {
  unpaid: 'bg-unpaid-soft text-unpaid-text',
  paid: 'bg-paid-soft text-paid-text',
  plain: 'bg-site-band text-site-muted',
} as const;

/** 화면 그림 속 상태 표시(미납·완납 등) */
export function StatusTag({ tone, children }: { tone: 'unpaid' | 'paid' | 'plain'; children: React.ReactNode }) {
  return (
    <span className={`inline-block text-[12.5px] font-semibold px-2 py-0.5 rounded-full ${TAG_TONE[tone]}`}>
      {children}
    </span>
  );
}
