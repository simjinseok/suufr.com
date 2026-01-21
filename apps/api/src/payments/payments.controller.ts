import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto, ListPaymentsQueryDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Query() query: ListPaymentsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.findAll(query, user.userId);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.findOne(uuid, user.userId);
  }

  @Post()
  create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.create(createPaymentDto, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.update(uuid, updatePaymentDto, user.userId);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.remove(uuid, user.userId);
  }
}
