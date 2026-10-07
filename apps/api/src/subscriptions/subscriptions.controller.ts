import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsBillingService } from './subscriptions-billing.service';
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
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.subscriptionsService.getSummary(user.userId);
    return { success: true, data };
  }

  /**
   * 프로 체크아웃 시작 — 서버가 만든 Paddle transactionId 를 돌려준다
   * (이메일 미인증·이미 프로인 계정은 400). 호출마다 Paddle 거래가 생기므로 분당 10회로 제한
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('checkout')
  async createCheckout(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.billingService.createCheckout(user.userId);
    return { success: true, data };
  }

  /**
   * 결제 건의 인보이스 PDF URL 발급 (Paddle 거래만, 1시간 유효)
   */
  @Get('orders/:transactionId/invoice')
  async getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
  ) {
    const data = await this.billingService.getInvoiceUrl(user.userId, transactionId);
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
