import { Controller, Get, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('api/subscription')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * 현재 사용자의 구독 요약 (플랜/한도/사용량/플랜 비교표)
   */
  @Get()
  async getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('organizationUuid') organizationUuid?: string,
  ) {
    const data = await this.subscriptionsService.getSummary(user.userId, organizationUuid);
    return { success: true, data };
  }
}
