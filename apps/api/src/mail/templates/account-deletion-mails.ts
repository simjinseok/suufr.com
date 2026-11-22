import { renderMail } from './layout';

/** 계정 삭제 확인 코드 유효 시간(분). AccountDeletionOtpService 의 만료와 같아야 한다 */
export const ACCOUNT_DELETION_OTP_MINUTES = 10;

/** 계정 삭제 확인 코드 (비밀번호가 없는 계정의 재인증) */
export function deleteAccountOtpMail(to: string, otp: string) {
  return renderMail({
    to,
    subject: '계정 삭제 확인 코드',
    title: '계정 삭제를 확인해주세요',
    paragraphs: [
      '아래 6자리 코드를 계정 삭제 화면에 입력하면 계정과 모든 데이터가 바로 삭제됩니다. 삭제하면 되돌릴 수 없습니다.',
      `코드는 ${ACCOUNT_DELETION_OTP_MINUTES}분 동안만 유효합니다.`,
    ],
    highlight: otp,
    footer: '본인이 요청하지 않았다면 이 메일을 무시하세요. 코드를 입력하지 않으면 계정은 삭제되지 않습니다.',
  });
}

/** 계정 삭제 완료 안내. 다른 사람이 지운 경우 본인이 알아챌 수 있게 보낸다 */
export function accountDeletedMail(to: string, canceledSubscription: boolean) {
  return renderMail({
    to,
    subject: '계정이 삭제되었습니다',
    title: '스프 계정이 삭제되었습니다',
    paragraphs: [
      '요청하신 대로 계정과 과외방·수강생·수강권·수업·파일 등 모든 데이터를 삭제했습니다.',
      ...(canceledSubscription ? ['이용 중이던 프로 구독은 즉시 해지되어 더 이상 결제되지 않습니다.'] : []),
      '법령에 따라 보관해야 하는 결제 기록과 약관 동의 이력은 개인정보처리방침에 적힌 기간 동안만 분리 보관한 뒤 파기합니다.',
    ],
    footer: '본인이 삭제하지 않았다면 support@suufr.com으로 바로 알려주세요.',
  });
}
