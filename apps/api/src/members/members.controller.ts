import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('organizations/:organizationUuid/members')
  findAllByOrganization(
    @Param('organizationUuid') organizationUuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.findAllByOrganization(organizationUuid, user.userId);
  }

  @Post('organizations/:organizationUuid/members')
  create(
    @Param('organizationUuid') organizationUuid: string,
    @Body() createMemberDto: CreateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.create(organizationUuid, createMemberDto, user.userId);
  }

  @Get('members/:uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.findOne(uuid, user.userId);
  }

  @Patch('members/:uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.update(uuid, updateMemberDto, user.userId);
  }

  @Delete('members/:uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.remove(uuid, user.userId);
  }
}
