import { Controller, Get, Patch, Post, Param, Body } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findAll(user.userId);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.findOne(uuid, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.update(uuid, updateOrganizationDto, user.userId);
  }

  @Post(':uuid/switch')
  switchOrganization(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.switchOrganization(uuid, user.userId);
  }
}
