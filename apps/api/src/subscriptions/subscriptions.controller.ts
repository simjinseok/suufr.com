import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsBillingService } from './subscriptions-billing.service';
import { ActivateBillingDto } from './dto/activate-billing.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('api/subscription')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly billingService: SubscriptionsBillingService,
  ) {}

  /**
   * 현재 사용자의 구독 요약 (플랜/한도/사용량/플랜 비교표/결제 내역)
   */
  @Get()
  async getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationUuid') organizationUuid?: string,
  ) {
    const data = await this.subscriptionsService.getSummary(user.userId, organizationUuid);
    return { success: true, data };
  }

  /**
   * 카드 등록창에서 받은 authKey로 프로 플랜 활성화 (빌링키 발급 + 첫 결제)
   */
  @Post('billing/activate')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ActivateBillingDto,
  ) {
    const data = await this.billingService.activate(user.userId, dto.authKey, user.email);
    return { success: true, data };
  }

  /**
   * 해지 예약 (기간 종료까지 프로 유지)
   */
  @Post('cancel')
  async cancel(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.billingService.cancel(user.userId);
    return { success: true, data };
  }

  /**
   * 해지 취소 (갱신 재개)
   */
  @Post('resume')
  async resume(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.billingService.resume(user.userId);
    return { success: true, data };
  }
}
