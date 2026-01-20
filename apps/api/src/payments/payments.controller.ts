import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @CurrentOrganization() org: CurrentOrganizationData,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.paymentsService.findAll(org.organization.id, org.member.id, year, month);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.paymentsService.findOne(uuid, org.organization.id, org.member.id);
  }

  @Post()
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.paymentsService.create(createPaymentDto, org.organization.id, org.member.id);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.paymentsService.update(uuid, updatePaymentDto, org.organization.id, org.member.id);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.paymentsService.remove(uuid, org.organization.id, org.member.id);
  }
}
