import { ForbiddenException } from '@nestjs/common';
import { GoogleController } from './google.controller';

/** 서비스는 모두 mock. Google 캘린더 연동 시작(connect)의 미인증 차단만 검증한다 */
function build(isUnverifiedPasswordUser: boolean) {
  const googleService = { getAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?x') };
  const betterAuth = { isUnverifiedPasswordUser: vi.fn().mockResolvedValue(isUnverifiedPasswordUser) };
  const controller = new GoogleController(googleService as never, {} as never, {} as never, betterAuth as never);
  return { controller, googleService, betterAuth };
}

const user = { userId: 'u1', email: 'a@b.c' } as never;

describe('GoogleController.connect', () => {
  it('비밀번호 계정이 있는 미인증 사용자는 403 EMAIL_NOT_VERIFIED 로 막고 연동 주소를 만들지 않는다', async () => {
    const { controller, googleService, betterAuth } = build(true);
    await expect(controller.connect(user)).rejects.toSatisfy((e: unknown) =>
      e instanceof ForbiddenException && (e.getResponse() as { error: string }).error === 'EMAIL_NOT_VERIFIED');
    expect(betterAuth.isUnverifiedPasswordUser).toHaveBeenCalledWith('u1');
    expect(googleService.getAuthUrl).not.toHaveBeenCalled();
  });

  it('그 밖의 사용자(인증된 사용자, Google 로만 가입한 사용자)는 연동 주소를 돌려준다', async () => {
    const { controller, googleService } = build(false);
    await expect(controller.connect(user)).resolves.toEqual({
      success: true,
      data: { authUrl: 'https://accounts.google.com/o/oauth2/auth?x' },
    });
    expect(googleService.getAuthUrl).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{64}$/));
  });
});
