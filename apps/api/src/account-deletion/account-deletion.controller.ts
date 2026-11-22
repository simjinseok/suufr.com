import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

/**
 * 계정 삭제 (회원 탈퇴). JWT 로 인증된 사용자 본인만. 웹·iOS 공통.
 * 비밀번호·코드 대입을 막기 위해 IP 당 분당 5회로 제한한다 (코드 자체도 5회 실패하면 폐기).
 */
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Controller('auth/account')
export class AccountDeletionController {
  constructor(private readonly accountDeletion: AccountDeletionService) {}

  /** 비밀번호가 없는 계정의 확인 코드를 계정 이메일로 보낸다 (10분 유효, 재요청은 60초에 한 번) */
  @Post('delete-otp')
  async sendOtp(@CurrentUser() user: AuthenticatedUser) {
    await this.accountDeletion.sendOtp(user.userId);
    return { success: true };
  }

  /** 즉시·영구 삭제. 성공하면 이 사용자의 JWT·세션은 더 이상 통하지 않는다 */
  @Post('delete')
  async deleteAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteAccountDto) {
    await this.accountDeletion.deleteAccount(user.userId, { password: dto.password, otp: dto.otp });
    return { success: true };
  }
}
