import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboardData(
    @Query('organizationId') organizationId?: number,
    @Query('memberId') memberId?: number,
  ) {
    return this.dashboardService.getDashboardData(organizationId, memberId);
  }
}
