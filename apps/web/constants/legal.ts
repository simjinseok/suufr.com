/**
 * 법적 문서 버전(시행일). 가입 동의 이력에 기록되고 약관·방침 페이지의 시행일 표기에 쓴다.
 * apps/api/src/common/constants/legal.ts 와 값이 같아야 한다 (미러). 개정 시 두 파일의 값을 함께 올린다.
 * 개정해도 재동의를 요구하지 않는다 — 약관 제3조대로 시행 7일 전(불리한 변경은 30일 전) 이메일 공지로 갈음한다(운영 작업).
 */
export const TERMS_VERSION = '2026-07-08';
export const PRIVACY_POLICY_VERSION = '2026-07-08';

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' */
export function formatLegalDate(version: string): string {
  const [year, month, day] = version.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
