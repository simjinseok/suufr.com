import type { Metadata } from 'next';

import { LegalList, LegalSection, LegalTitle } from '../_legal';

export const metadata: Metadata = {
  title: '환불정책 - 스프',
  description: '스프(Suufr) 유료 구독 환불정책',
};

export default function RefundsPage() {
  return (
    <>
      <LegalTitle effectiveDate="2026년 7월 8일">환불정책</LegalTitle>

      <p className="text-[15px] leading-relaxed text-gray-600">
        스프(Suufr)의 프로 플랜은 월 6,900원(부가가치세 포함)의 월 단위 구독 상품으로, 매월 자동
        갱신됩니다. 결제는 판매 대행사(Merchant of Record)인 Paddle을 통해 처리됩니다.
      </p>

      <LegalSection title="1. 구독 해지">
        <LegalList
          items={[
            '언제든지 서비스 내 설정 > 요금제에서 구독을 해지할 수 있습니다.',
            '해지해도 이미 결제한 이용 기간이 끝날 때까지 프로 기능을 계속 이용할 수 있으며, 다음 결제일부터 요금이 청구되지 않습니다.',
            '해지 후 마음이 바뀌면 이용 기간이 끝나기 전까지 같은 화면에서 해지를 취소(구독 재개)할 수 있습니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. 환불 기준">
        <LegalList
          items={[
            '첫 결제 또는 갱신 결제일로부터 7일 이내이고 해당 결제 기간에 프로 전용 기능을 사용한 이력이 없는 경우, 요청 시 전액 환불해 드립니다.',
            '중복 결제, 시스템 오류로 인한 잘못된 결제는 기간과 관계없이 전액 환불해 드립니다.',
            '위 경우를 제외하고, 이미 개시된 결제 기간에 대한 부분 환불(일할 계산 환불)은 제공하지 않습니다. 대신 해지 시 남은 기간 동안 서비스를 계속 이용할 수 있습니다.',
            '서비스의 중대한 장애 또는 서비스 종료로 유료 기능을 이용할 수 없게 된 경우, 잔여 기간에 대해 환불해 드립니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. 환불 요청 방법">
        <LegalList
          items={[
            <>
              이메일
              {' '}
              <a href="mailto:support@suufr.com" className="underline underline-offset-2">support@suufr.com</a>
              으로 가입 이메일과 함께 요청해 주세요.
            </>,
            'Paddle에서 발송한 결제 영수증 이메일의 링크를 통해 Paddle에 직접 환불을 요청할 수도 있습니다.',
            '요청은 영업일 기준 3일 이내에 답변드리며, 승인된 환불은 Paddle을 통해 원래 결제 수단으로 환급됩니다(카드사에 따라 3~10 영업일 소요).',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. 기타">
        <p>
          이 정책에서 정하지 않은 사항은 이용약관 및 「전자상거래 등에서의 소비자보호에 관한 법률」 등
          관련 법령에 따릅니다.
        </p>
      </LegalSection>
    </>
  );
}
