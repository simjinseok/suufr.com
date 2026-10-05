/**
 * 법적 문서 버전(시행일). 가입 동의 이력에 기록되고, 사용자의 동의 버전과 비교해 재동의 필요 여부를 판단한다.
 * apps/api/src/common/constants/legal.ts 와 값이 같아야 한다 (미러).
 * 방침·약관을 개정해 재동의가 필요하면 두 파일의 값을 함께 올린다.
 */
export const TERMS_VERSION = '2026-07-08';
export const PRIVACY_POLICY_VERSION = '2026-07-08';

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일' */
export function formatLegalDate(version: string): string {
  const [year, month, day] = version.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
