import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalList, LegalSection, LegalTitle } from '../_legal';

export const metadata: Metadata = {
  title: '이용약관 - 스프',
  description: '스프(Suufr) 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <>
      <LegalTitle effectiveDate="2026년 7월 8일">이용약관</LegalTitle>

      <LegalSection title="제1조 (목적)">
        <p>
          이 약관은 스프(Suufr, 이하 &ldquo;서비스&rdquo;)가 제공하는 과외 일정 및 수업 관리 서비스의
          이용 조건과 절차, 서비스와 회원 간의 권리·의무 및 책임 사항을 정함을 목적으로 합니다.
        </p>
      </LegalSection>

      <LegalSection title="제2조 (정의)">
        <LegalList
          items={[
            '"서비스"란 회원이 수강생, 수업 일정, 수업 기록, 수강료 정산 등을 관리할 수 있도록 제공되는 웹 기반 소프트웨어를 말합니다.',
            '"회원"이란 이 약관에 동의하고 계정을 생성하여 서비스를 이용하는 자를 말합니다.',
            '"유료 서비스"란 월 구독 방식으로 제공되는 프로 플랜 등 대가를 지급하고 이용하는 서비스를 말합니다.',
            '"콘텐츠"란 회원이 서비스에 입력·업로드하는 수강생 정보, 수업 기록, 파일 등 일체의 자료를 말합니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제3조 (약관의 게시와 개정)">
        <p>
          서비스는 이 약관을 서비스 웹사이트에 게시합니다. 관련 법령을 위배하지 않는 범위에서 약관을
          개정할 수 있으며, 개정 시 적용일자와 개정 사유를 명시하여 적용일 7일 전부터(회원에게 불리한
          변경은 30일 전부터) 서비스 내 공지 또는 이메일로 알립니다. 회원이 개정 약관 적용일까지 거부
          의사를 표시하지 않고 서비스를 계속 이용하는 경우 개정 약관에 동의한 것으로 봅니다.
        </p>
      </LegalSection>

      <LegalSection title="제4조 (서비스의 내용)">
        <p>서비스는 다음 기능을 제공합니다.</p>
        <LegalList
          items={[
            '수강생 정보 및 수업 이력 관리',
            '수업 일정 관리 및 캘린더 연동',
            '수업 기록·피드백 작성 및 공유 링크 제공',
            '수강료·입금 내역 관리',
            '파일 저장 공간 제공',
          ]}
        />
        <p>
          서비스의 구체적인 기능은 운영상·기술상 필요에 따라 변경될 수 있으며, 중요한 변경은 사전에
          공지합니다.
        </p>
      </LegalSection>

      <LegalSection title="제5조 (계정)">
        <LegalList
          items={[
            '회원은 정확한 정보로 계정을 생성해야 하며, 계정 정보가 변경된 경우 이를 갱신해야 합니다.',
            '계정과 비밀번호의 관리 책임은 회원에게 있으며, 제3자에게 계정을 양도하거나 대여할 수 없습니다.',
            '회원은 언제든지 서비스 내 설정에서 탈퇴할 수 있으며, 탈퇴 시 관련 법령 및 개인정보처리방침에 따라 데이터가 삭제됩니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제6조 (유료 서비스 및 결제)">
        <LegalList
          items={[
            '프로 플랜의 이용 요금은 월 6,900원(부가가치세 포함)이며, 매월 자동으로 갱신·결제됩니다.',
            <>
              결제는 서비스의 판매 대행사(Merchant of Record)인
              {' '}
              <a href="https://www.paddle.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">Paddle</a>
              을 통해 처리됩니다. 카드 명세서에는 &ldquo;PADDLE.NET&rdquo;으로 표기될 수 있으며,
              서비스는 회원의 카드 정보를 직접 수집·저장하지 않습니다.
            </>,
            '요금이 변경되는 경우 최소 30일 전에 공지하며, 변경된 요금은 다음 결제 주기부터 적용됩니다.',
            '무료 플랜의 이용 한도(수강생 수, 저장 공간 등)는 서비스 웹사이트의 요금제 안내에 따릅니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제7조 (해지 및 환불)">
        <LegalList
          items={[
            '회원은 언제든지 서비스 내 설정에서 구독을 해지할 수 있습니다. 해지 시 이미 결제한 이용 기간이 끝날 때까지 유료 기능을 계속 이용할 수 있으며, 이후 자동으로 무료 플랜으로 전환됩니다.',
            <>
              환불은
              {' '}
              <Link href="/refunds" className="underline underline-offset-2">환불정책</Link>
              에 따릅니다.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="제8조 (회원의 콘텐츠와 책임)">
        <LegalList
          items={[
            '회원이 서비스에 입력한 콘텐츠의 권리와 책임은 회원에게 있습니다. 서비스는 서비스 제공 목적 범위에서만 콘텐츠를 저장·처리합니다.',
            '회원이 수강생 등 제3자의 개인정보를 서비스에 입력하는 경우, 해당 정보 수집·이용에 필요한 동의 확보 등 관련 법령 준수 책임은 회원에게 있습니다.',
            '서비스는 회원의 콘텐츠를 광고 등 다른 목적으로 이용하지 않습니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제9조 (금지 행위)">
        <p>회원은 다음 행위를 해서는 안 됩니다.</p>
        <LegalList
          items={[
            '타인의 계정 도용 또는 개인정보 무단 수집',
            '서비스의 정상적인 운영을 방해하는 행위(비정상적 트래픽 유발, 취약점 악용 등)',
            '법령 또는 공서양속에 반하는 콘텐츠의 저장·유포',
            '서비스를 역설계·복제하여 유사 서비스를 만드는 행위',
          ]}
        />
      </LegalSection>

      <LegalSection title="제10조 (서비스의 변경·중단)">
        <p>
          서비스는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다.
          유료 서비스에 중대한 영향을 주는 변경·중단의 경우 사전에 공지하고, 이미 결제한 기간에
          대해서는 환불정책에 따라 잔여 기간을 환불합니다.
        </p>
      </LegalSection>

      <LegalSection title="제11조 (책임의 제한)">
        <LegalList
          items={[
            '서비스는 천재지변, 통신 장애 등 불가항력으로 인한 서비스 제공 불가에 대해 책임을 지지 않습니다.',
            '서비스는 회원 간 또는 회원과 수강생(학부모) 간에 발생한 분쟁에 개입하지 않으며, 이에 대한 책임을 지지 않습니다.',
            '서비스는 무료로 제공되는 기능의 이용과 관련하여 관련 법령이 허용하는 범위에서 책임을 제한합니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제12조 (준거법 및 관할)">
        <p>
          이 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생한 경우
          민사소송법에 따른 관할 법원에 소를 제기할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="부칙">
        <p>이 약관은 2026년 7월 8일부터 시행합니다.</p>
        <p>
          문의:
          {' '}
          <a href="mailto:support@suufr.com" className="underline underline-offset-2">support@suufr.com</a>
        </p>
      </LegalSection>
    </>
  );
}
