import type { ConfigService } from '@nestjs/config';
import { appleRevokeKeysMissing, readAppleSignInConfig } from './better-auth.provider';

const config = (env: Record<string, string | undefined>) => ({ get: (key: string) => env[key] }) as unknown as ConfigService;

describe('readAppleSignInConfig', () => {
  it('APPLE_APP_BUNDLE_ID 가 없으면 Apple 로그인 비활성(undefined)', () => {
    expect(readAppleSignInConfig(config({ APPLE_ID_TOKEN_AUDIENCES: 'com.suufr.ios.dev' }))).toBeUndefined();
  });

  it('쉼표 구분 APPLE_ID_TOKEN_AUDIENCES 를 공백·빈 값 없이 읽는다', () => {
    expect(readAppleSignInConfig(config({ APPLE_APP_BUNDLE_ID: 'com.suufr.ios', APPLE_ID_TOKEN_AUDIENCES: ' com.suufr.ios.dev , ,' })))
      .toEqual({ bundleId: 'com.suufr.ios', idTokenAudiences: ['com.suufr.ios.dev'] });
    expect(readAppleSignInConfig(config({ APPLE_APP_BUNDLE_ID: 'com.suufr.ios' })))
      .toEqual({ bundleId: 'com.suufr.ios', idTokenAudiences: [] });
  });
});

describe('appleRevokeKeysMissing', () => {
  const ALL = { APPLE_APP_BUNDLE_ID: 'com.suufr.ios', APPLE_TEAM_ID: 'TEAM', APPLE_KEY_ID: 'KEY', APPLE_PRIVATE_KEY: 'PEM' };

  it('Apple 로그인이 켜져 있고 revoke 키가 모두 있으면 경고하지 않는다', () => {
    expect(appleRevokeKeysMissing(config(ALL))).toBe(false);
  });

  it.each(['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'])('Apple 로그인이 켜져 있는데 %s 가 빠지면 경고한다', (missing) => {
    expect(appleRevokeKeysMissing(config({ ...ALL, [missing]: undefined }))).toBe(true);
  });

  it('Apple 로그인이 꺼져 있으면(APPLE_APP_BUNDLE_ID 없음) 키가 없어도 경고하지 않는다', () => {
    expect(appleRevokeKeysMissing(config({}))).toBe(false);
  });
});
