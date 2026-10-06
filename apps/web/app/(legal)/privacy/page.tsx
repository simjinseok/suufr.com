import type { Metadata } from 'next';

import { LegalList, LegalSection, LegalTable, LegalTitle } from '../_legal';
import { PRIVACY_POLICY_VERSION, formatLegalDate } from '@/constants/legal';

export const metadata: Metadata = {
  title: '개인정보처리방침 - 스프',
  description: '스프(Suufr) 개인정보처리방침',
};

const SUPPORT_EMAIL = 'support@suufr.com';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <LegalTitle effectiveDate={formatLegalDate(PRIVACY_POLICY_VERSION)}>개인정보처리방침</LegalTitle>

      <p className="text-[15px] leading-relaxed text-gray-600">
        스프(Suufr, 이하 &ldquo;스프&rdquo;)는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고
        이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
      </p>

      <LegalSection title="1. 수집하는 개인정보 항목 및 수집 방법">
        <p>스프는 회원가입 및 서비스 이용 과정에서 다음 정보를 수집합니다.</p>
        <LegalList
          items={[
            '회원가입 시 (필수): 이메일 주소, 이름, 비밀번호. 비밀번호는 복호화할 수 없는 단방향 해시 형태로만 저장합니다.',
            '회원가입 시 동의 이력: 이용약관·개인정보 수집·이용·국외 이전 동의 여부, 동의한 문서의 시행일(버전), 동의 일시, 동의 시점의 IP 주소와 브라우저 정보(User-Agent)',
            '서비스 이용 과정에서 자동 수집: IP 주소, 브라우저·기기 정보, 접속 일시, 방문 페이지, 쿠키(제12조 참조), 오류 발생 시의 화면 조작 기록(입력 텍스트는 마스킹되고 이미지·동영상은 차단된 상태로 수집)',
            '서비스 이용 중 이용자가 직접 입력: 수강생 정보(이름, 연락처, 이메일, 생일 등), 수업 일정·기록·피드백, 수강료·입금 내역, 업로드 파일(이미지·동영상·문서), 과외방 정보(이름, 연락처, 주소, 로고)',
            'Google 캘린더 연동 선택 시: Google 계정 이메일과 식별자, 캘린더 접근 토큰(암호화 저장), 스프가 생성한 캘린더의 일정 데이터',
            'CalDAV/CardDAV 앱 연동 선택 시: 앱 토큰(해시 저장), 토큰 이름(기기명), 마지막 사용 일시',
            '유료 결제 시: 결제는 결제 대행사 Paddle이 처리하며, 스프는 카드번호 등 결제수단 정보를 직접 수집·저장하지 않습니다. 스프는 Paddle 고객 식별자, 구독 상태, 결제 금액, 결제 성공/실패 여부와 일시만 보관합니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. 개인정보의 처리 목적">
        <LegalList
          items={[
            '회원 식별, 로그인 등 계정 관리',
            '과외 일정·수업·정산 관리 등 서비스 핵심 기능 제공',
            '유료 구독의 결제·갱신·해지 처리 및 결제 내역 안내',
            '서비스 오류 분석 및 품질 개선',
            '서비스 이용 통계 분석(Google Analytics)',
            '이용약관·개인정보처리방침 동의 이력의 보존 및 분쟁 대응',
            '공지사항 전달 등 회원과의 소통',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. 개인정보의 보유 및 이용 기간">
        <p>
          개인정보는 수집·이용 목적이 달성되거나 회원이 탈퇴하면 지체 없이 파기합니다. 다만 다음 정보는
          해당 기간 동안 분리 보관한 뒤 파기합니다.
        </p>
        <LegalList
          items={[
            '계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)',
            '대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)',
            '소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)',
            '이용약관·개인정보처리방침 동의 이력: 탈퇴 후 3년 (분쟁 대응)',
            '이메일 인증을 완료하지 않은 가입 신청 정보: 인증 완료 전까지 서비스를 이용할 수 없으며, 이용자의 삭제 요청 시 지체 없이 파기',
            '이용자가 서비스 내에서 삭제한 콘텐츠: 삭제 시점부터 복구 불가능하게 처리되며, 백업 보존 주기가 지나면 영구 삭제됩니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. 개인정보의 파기 절차 및 방법">
        <p>
          보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 법령에 따라 보존해야 하는
          정보는 다른 개인정보와 분리하여 보존 기간 동안만 보관합니다. 전자적 파일 형태의 정보는 복구·재생이
          불가능한 방법으로 영구 삭제하며, 출력물은 분쇄 또는 소각합니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 개인정보의 제3자 제공">
        <p>
          스프는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 이용자가 별도로 동의하거나
          법령에 근거한 적법한 요청이 있는 경우는 예외로 합니다.
        </p>
      </LegalSection>

      <LegalSection title="6. 개인정보 처리의 위탁">
        <p>스프는 서비스 제공을 위해 다음 업체에 개인정보 처리를 위탁하고 있습니다.</p>
        <LegalTable
          headers={['수탁자', '위탁 업무']}
          rows={[
            ['Amazon Web Services, Inc. (미국)', '서버 운영(서울 리전), 파일 저장·전송(S3, CloudFront, 서울 리전), 인증·알림 이메일 발송(Amazon SES, 도쿄 리전)'],
            ['Neon, Inc. (미국)', '데이터베이스 운영(AWS 싱가포르 리전)'],
            ['Paddle.com Market Ltd (영국)', '유료 구독 결제 처리(판매 대행, Merchant of Record), 결제 영수증 발행'],
            ['Functional Software, Inc. (Sentry, 미국)', '서비스 오류·성능 모니터링, 오류 발생 시 세션 리플레이 수집'],
            ['Google LLC (미국)', '서비스 이용 통계 분석(Google Analytics)'],
          ]}
        />
        <p>
          서버와 업로드 파일은 대한민국 서울 리전에서 처리·저장됩니다. 데이터베이스(싱가포르)와 이메일
          발송(일본)은 국외에서 처리되며, 자세한 내용은 제7조를 따릅니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 개인정보의 국외 이전">
        <div id="overseas-transfer" className="scroll-mt-28">
          <p>
            스프는 서비스 제공을 위해 다음과 같이 개인정보를 국외로 이전합니다. 이용자는 회원가입 시 이에 동의하며,
            동의를 거부할 수 있으나 이 경우 서비스 가입과 유료 결제를 이용할 수 없습니다.
          </p>
        </div>
        <LegalTable
          headers={['이전받는 자 (연락처)', '이전 국가', '이전 일시 및 방법', '이전 항목', '이용 목적', '보유·이용 기간']}
          rows={[
            [
              <>
                Neon, Inc.
                <br />
                (privacy@neon.tech)
              </>,
              '싱가포르 (AWS 싱가포르 리전)',
              '서비스 이용 시 네트워크를 통해 전송·저장',
              '제1조의 개인정보 전부 (이메일 주소, 이름, 비밀번호 해시, 동의 이력, 수강생 정보, 수업·정산 기록, 연동 정보 등)',
              '서비스 데이터베이스 운영',
              '회원 탈퇴 시 또는 제3조의 보유 기간까지',
            ],
            [
              <>
                Amazon Web Services, Inc.
                <br />
                (
                <ExternalLink href="https://aws.amazon.com/privacy/">개인정보처리방침</ExternalLink>
                )
              </>,
              '일본 (AWS 도쿄 리전)',
              '회원가입·비밀번호 재설정 등 인증 메일 발송 시 네트워크를 통해 전송',
              '이메일 주소, 발송 메일 내용(인증코드 등)',
              '인증·알림 이메일 발송(Amazon SES)',
              '메일 발송 처리 완료 시까지',
            ],
            [
              <>
                Paddle.com Market Ltd
                <br />
                (privacy@paddle.com)
              </>,
              '영국',
              '유료 결제 시 네트워크를 통해 전송',
              '이메일 주소, 결제 국가, 결제수단 정보(Paddle이 직접 수집)',
              '구독 결제 처리 및 영수증 발행',
              'Paddle 개인정보 정책 및 관련 법령에 따른 보존 기간',
            ],
            [
              <>
                Functional Software, Inc. (Sentry)
                <br />
                (privacy@sentry.io)
              </>,
              '미국',
              '오류 발생 시 네트워크를 통해 전송',
              '오류 정보, 브라우저·운영체제 정보, 마스킹된 화면 조작 기록 (IP 주소·요청 본문·쿠키는 수집하지 않도록 설정)',
              '서비스 오류 분석 및 품질 개선',
              '90일',
            ],
            [
              <>
                Google LLC (Google Analytics)
                <br />
                (
                <ExternalLink href="https://policies.google.com/privacy">개인정보처리방침</ExternalLink>
                )
              </>,
              '미국',
              '페이지 접속 시 네트워크를 통해 전송',
              '쿠키 식별자, 방문 페이지, 접속 일시, 기기·브라우저 정보, 축약된 IP 주소',
              '서비스 이용 통계 분석',
              'Google Analytics 데이터 보존 설정에 따름 (최대 14개월)',
            ],
          ]}
        />
        <p>
          Google Analytics에 의한 이전은 제12조에 안내된 방법으로 거부할 수 있으며, 거부해도 서비스 이용에
          제한이 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="8. Google 캘린더 연동">
        <p>
          이용자가 Google 캘린더 연동을 선택한 경우, 수업 일정 동기화 목적으로만 Google 계정의 캘린더
          데이터에 접근합니다. Google 데이터의 이용은
          {' '}
          <ExternalLink href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API 서비스 사용자 데이터 정책
          </ExternalLink>
          의 제한적 사용(Limited Use) 요건을 준수하며, 광고 등 다른 목적으로 사용하지 않습니다. 연동은
          설정에서 언제든 해제할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="9. 수강생 정보에 관한 안내">
        <p>
          이용자(선생님)가 서비스에 입력하는 수강생 정보는 이용자의 관리 목적을 위해 저장되는 것으로,
          해당 정보의 수집·이용에 필요한 동의 확보 등의 책임은 이용자에게 있습니다. 스프는 이 정보를
          이용자에게 서비스를 제공하는 목적 외로 이용하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection title="10. 정보주체의 권리·의무 및 행사 방법">
        <LegalList
          items={[
            '이용자는 언제든지 자신의 개인정보에 대해 열람, 정정·삭제, 처리정지, 동의 철회를 요구할 수 있습니다.',
            `권리 행사는 ${SUPPORT_EMAIL}으로 이메일을 보내 요청할 수 있으며, 스프는 요청을 확인한 후 지체 없이(10일 이내) 조치합니다.`,
            `회원 탈퇴는 ${SUPPORT_EMAIL}으로 요청할 수 있으며, 스프는 요청을 확인한 후 지체 없이 계정과 데이터를 삭제합니다. 서비스 내 탈퇴 기능은 추후 제공 예정입니다.`,
            '권리 행사는 법정대리인이나 위임을 받은 자를 통해서도 할 수 있습니다. 이 경우 위임장을 제출해야 합니다.',
            '다른 법령에서 수집 대상으로 명시된 개인정보는 삭제를 요구할 수 없습니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="11. 개인정보의 안전성 확보 조치">
        <LegalList
          items={[
            '비밀번호의 단방향 해시 저장 및 세션·인증 정보의 암호화 보관',
            '전송 구간 암호화(HTTPS)',
            '이용자별 데이터 격리 및 접근 통제',
            'Google 연동 토큰 등 민감한 연동 정보의 암호화 보관',
            '오류 수집 도구(Sentry)로 이용자 IP 주소, 요청 본문, 쿠키가 전송되지 않도록 설정',
            '동의 이력의 수정·삭제 없는 추가 전용 보관',
            '개인정보 취급자 최소화',
          ]}
        />
      </LegalSection>

      <LegalSection title="12. 쿠키 및 자동 수집 장치의 설치·운영·거부">
        <p>스프는 다음 쿠키 및 유사 기술을 사용합니다.</p>
        <LegalList
          items={[
            '필수 쿠키: 로그인 상태 유지, 추가 인증(MFA) 처리, 선택한 과외방 기억, 보호된 파일 접근 권한 확인에 사용합니다. 브라우저에서 차단할 수 있으나 이 경우 로그인이 필요한 기능을 이용할 수 없습니다.',
            <>
              분석 쿠키: Google Analytics가 방문 페이지, 접속 기기, 유입 경로 등 방문 통계를 수집합니다.
              브라우저의 쿠키 설정 또는
              {' '}
              <ExternalLink href="https://tools.google.com/dlpage/gaoptout">Google 애널리틱스 차단 브라우저 부가기능</ExternalLink>
              으로 거부할 수 있으며, 거부해도 서비스 이용에 제한이 없습니다.
            </>,
            '오류 분석: Sentry가 오류 발생 시 직전의 화면 조작 기록을 전송합니다. 입력한 텍스트는 마스킹되고 이미지·동영상은 차단됩니다.',
          ]}
        />
        <p>스프는 광고 목적의 쿠키를 사용하지 않습니다.</p>
      </LegalSection>

      <LegalSection title="13. 개인정보 보호책임자 및 문의처">
        <p>
          스프는 개인정보 처리에 관한 업무를 총괄하고, 관련 문의·불만 처리 및 피해 구제를 위해 아래와 같이
          개인정보 보호책임자를 지정하고 있습니다.
        </p>
        <LegalList
          items={[
            '성명: 스프',
            '직책: 운영자',
            <>
              이메일:
              {' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="14. 권익침해 구제방법">
        <p>
          이용자는 개인정보 침해에 대한 피해 구제, 상담 등을 아래 기관에 문의할 수 있습니다. 이 기관들은
          스프와는 별개의 기관으로, 스프의 자체 처리 결과에 만족하지 못하거나 더 자세한 도움이 필요한 경우
          문의하시기 바랍니다.
        </p>
        <LegalList
          items={[
            <>
              개인정보분쟁조정위원회: (국번없이) 1833-6972,
              <ExternalLink href="https://www.kopico.go.kr">www.kopico.go.kr</ExternalLink>
            </>,
            <>
              개인정보침해신고센터: (국번없이) 118,
              <ExternalLink href="https://privacy.kisa.or.kr">privacy.kisa.or.kr</ExternalLink>
            </>,
            <>
              대검찰청: (국번없이) 1301,
              <ExternalLink href="https://www.spo.go.kr">www.spo.go.kr</ExternalLink>
            </>,
            <>
              경찰청: (국번없이) 182,
              <ExternalLink href="https://ecrm.police.go.kr">ecrm.police.go.kr</ExternalLink>
            </>,
          ]}
        />
        <p>
          또한 개인정보 보호법에 따른 요구에 대해 공공기관의 장이 행한 처분 또는 부작위로 권리나 이익을
          침해받은 자는 행정심판법에 따라 행정심판을 청구할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="15. 만 14세 미만 아동의 개인정보">
        <p>
          스프는 만 14세 이상만 가입할 수 있으며, 만 14세 미만 아동의 개인정보를 수집하지 않습니다.
          이용자(선생님)가 수강생으로 입력하는 아동의 정보는 제9조에 따릅니다.
        </p>
      </LegalSection>

      <LegalSection title="16. 개인정보처리방침의 변경">
        <p>
          이 방침은
          {' '}
          {formatLegalDate(PRIVACY_POLICY_VERSION)}
          부터 시행합니다. 내용의 추가·삭제·수정이 있는 경우 시행 7일 전부터(이용자 권리에 중요한 변경은
          30일 전부터) 서비스 내 공지 또는 이메일로 알리며, 국외 이전 대상 추가 등 중요한 변경의 경우에는
          다시 동의를 받습니다.
        </p>
      </LegalSection>
    </>
  );
}
