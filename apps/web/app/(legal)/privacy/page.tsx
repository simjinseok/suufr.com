import type { Metadata } from 'next';

import { LegalList, LegalSection, LegalTitle } from '../_legal';

export const metadata: Metadata = {
  title: '개인정보처리방침 - 스프',
  description: '스프(Suufr) 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <>
      <LegalTitle effectiveDate="2026년 7월 8일">개인정보처리방침</LegalTitle>

      <p className="text-[15px] leading-relaxed text-gray-600">
        스프(Suufr, 이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 소중히 여기며, 「개인정보 보호법」 등
        관련 법령을 준수합니다. 이 방침은 서비스가 어떤 정보를 수집하고 어떻게 이용·보관·보호하는지
        설명합니다.
      </p>

      <LegalSection title="1. 수집하는 개인정보와 수집 방법">
        <p>회원가입 및 서비스 이용 과정에서 다음 정보를 수집합니다.</p>
        <LegalList
          items={[
            '필수 (회원가입 시): 이메일 주소, 이름, 비밀번호',
            '자동 수집: 접속 기록, 쿠키, 오류 로그 등 서비스 이용 기록',
            '서비스 이용 중 이용자가 입력하는 정보: 수강생 정보(이름, 연락처 등), 수업 일정·기록, 수강료 내역, 업로드 파일',
            '유료 결제 시: 결제는 결제 대행사 Paddle이 처리하며, 서비스는 카드번호 등 결제수단 정보를 직접 수집·저장하지 않습니다. 서비스는 구독 상태, 결제 금액, 결제 성공/실패 여부만 보관합니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. 개인정보의 이용 목적">
        <LegalList
          items={[
            '회원 식별, 로그인 등 계정 관리',
            '과외 일정·수업·정산 관리 등 서비스 핵심 기능 제공',
            '유료 구독의 결제·갱신·해지 처리 및 결제 내역 안내',
            '서비스 오류 분석 및 품질 개선',
            '공지사항 전달 등 회원과의 소통',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. 보유 및 이용 기간">
        <LegalList
          items={[
            '회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 보존이 필요한 정보(예: 전자상거래법에 따른 계약·결제 기록 5년)는 해당 기간 동안 분리 보관 후 파기합니다.',
            '이용자가 서비스 내에서 삭제한 콘텐츠는 서비스 정책에 따라 복구 불가능하게 삭제됩니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. 개인정보의 제3자 제공">
        <p>
          서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 이용자가 별도로 동의하거나
          법령에 근거한 적법한 요청이 있는 경우는 예외로 합니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 개인정보 처리의 위탁 및 국외 이전">
        <p>서비스 제공을 위해 다음 업체에 처리를 위탁하고 있습니다.</p>
        <LegalList
          items={[
            'Amazon Web Services (대한민국 서울 리전): 서버 운영, 회원 인증(Amazon Cognito), 파일 저장(S3)',
            'Paddle.com Market Ltd (영국/아일랜드): 유료 구독 결제 처리 — 결제 시 이메일 주소, 결제 정보가 Paddle에 직접 제공·처리됩니다',
            'Functional Software, Inc. (Sentry, 미국): 서비스 오류 수집·분석',
          ]}
        />
        <p>
          국외 사업자(Paddle, Sentry)에 대한 위탁은 서비스 제공에 필수적인 범위로 한정되며, 각 사업자는
          자체 개인정보 보호 정책에 따라 정보를 보호합니다.
        </p>
      </LegalSection>

      <LegalSection title="6. Google 캘린더 연동">
        <p>
          이용자가 Google 캘린더 연동을 선택한 경우, 수업 일정 동기화 목적으로만 Google 계정의 캘린더
          데이터에 접근합니다. Google 데이터의 이용은
          {' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Google API 서비스 사용자 데이터 정책
          </a>
          의 제한적 사용(Limited Use) 요건을 준수하며, 광고 등 다른 목적으로 사용하지 않습니다. 연동은
          설정에서 언제든 해제할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 수강생 정보에 관한 안내">
        <p>
          이용자(선생님)가 서비스에 입력하는 수강생 정보는 이용자의 관리 목적을 위해 저장되는 것으로,
          해당 정보의 수집·이용에 필요한 동의 확보 등의 책임은 이용자에게 있습니다. 서비스는 이 정보를
          이용자의 서비스 제공 목적 외로 이용하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection title="8. 이용자의 권리">
        <p>
          이용자는 언제든지 자신의 개인정보를 조회·수정할 수 있고, 회원 탈퇴를 통해 수집·이용 동의를
          철회할 수 있습니다. 열람·정정·삭제·처리정지 요구는 아래 문의처로 연락하면 지체 없이
          조치합니다.
        </p>
      </LegalSection>

      <LegalSection title="9. 개인정보의 안전성 확보 조치">
        <LegalList
          items={[
            '비밀번호 및 인증 정보의 암호화 저장(AWS Cognito)',
            '전송 구간 암호화(HTTPS)',
            '접근 권한 관리 및 접근 통제 — 이용자별 데이터 격리',
            '민감한 연동 토큰의 암호화 보관',
          ]}
        />
      </LegalSection>

      <LegalSection title="10. 쿠키의 사용">
        <p>
          서비스는 로그인 상태 유지를 위한 필수 쿠키를 사용합니다. 광고·추적 목적의 쿠키는 사용하지
          않습니다. 브라우저 설정에서 쿠키를 차단할 수 있으나, 이 경우 로그인이 필요한 기능을 이용할
          수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="11. 개인정보 보호책임자 및 문의처">
        <p>
          개인정보 처리에 관한 문의, 불만, 권리 행사 요청은 아래로 연락해 주세요.
        </p>
        <LegalList
          items={[
            <>
              이메일:
              {' '}
              <a href="mailto:support@suufr.com" className="underline underline-offset-2">support@suufr.com</a>
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="12. 고지 의무">
        <p>
          이 방침의 내용이 추가·삭제·수정되는 경우 시행 7일 전부터 서비스 내 공지사항을 통해
          알립니다.
        </p>
      </LegalSection>
    </>
  );
}
