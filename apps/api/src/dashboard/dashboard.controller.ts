import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboardData(@CurrentOrganization() org: CurrentOrganizationData) {
    return this.dashboardService.getDashboardData(org.organization.id, org.member.id);
  }
}
