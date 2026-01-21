import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { AppTokensService } from './app-tokens.service';
import { CreateAppTokenDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('app-tokens')
export class AppTokensController {
  constructor(private readonly appTokensService: AppTokensService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.appTokensService.findAll(user.userId);
  }

  @Post()
  create(
    @Body() createAppTokenDto: CreateAppTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appTokensService.create(user.userId, createAppTokenDto);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appTokensService.remove(uuid, user.userId);
  }
}
