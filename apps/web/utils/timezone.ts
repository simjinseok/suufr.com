/**
 * 표기·경계 계산에 쓸 타임존은 유저 설정(UserSettings.timezone)이 기준이다.
 * 설정이 비어 있으면 UTC로 간주하고, 첫 방문 시 TimezoneInitializer가
 * 브라우저 타임존으로 설정을 자동 초기화한다.
 */
export const DEFAULT_TIMEZONE = 'UTC';

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  }
  catch {
    return false;
  }
}
