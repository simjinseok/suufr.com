import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Query('organizationId') organizationId?: number,
    @Query('memberId') memberId?: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.paymentsService.findAll(organizationId, memberId, year, month);
  }

  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.paymentsService.findOne(uuid);
  }

  @Post()
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @Query('organizationId') organizationId: number,
    @Query('memberId') memberId: number,
  ) {
    return this.paymentsService.create(createPaymentDto, organizationId, memberId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(uuid, updatePaymentDto);
  }

  @Delete(':uuid')
  remove(@Param('uuid') uuid: string) {
    return this.paymentsService.remove(uuid);
  }
}
