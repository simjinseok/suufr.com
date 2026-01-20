import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { MemberStatusesService } from './member-statuses.service';
import { CreateMemberStatusDto, UpdateMemberStatusDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller()
export class MemberStatusesController {
  constructor(private readonly memberStatusesService: MemberStatusesService) {}

  @Get('members/:memberUuid/statuses')
  findByMember(
    @Param('memberUuid') memberUuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.memberStatusesService.findByMember(memberUuid, user.userId);
  }

  @Post('members/:memberUuid/statuses')
  create(
    @Param('memberUuid') memberUuid: string,
    @Body() dto: CreateMemberStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.memberStatusesService.create(memberUuid, dto, user.userId);
  }

  @Patch('member-statuses/:uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateMemberStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.memberStatusesService.update(uuid, dto, user.userId);
  }
}
