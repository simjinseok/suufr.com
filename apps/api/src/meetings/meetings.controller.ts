import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto, UpdateMeetingDto } from './dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  findAll(@CurrentOrganization() org: CurrentOrganizationData) {
    return this.meetingsService.findAll(org.organization.id);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.meetingsService.findOne(uuid, org.organization.id);
  }

  @Post()
  create(
    @Body() createMeetingDto: CreateMeetingDto,
    @CurrentOrganization() org: CurrentOrganizationData,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.create(createMeetingDto, org.organization.id, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateMeetingDto: UpdateMeetingDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.meetingsService.update(uuid, updateMeetingDto, org.organization.id);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.meetingsService.remove(uuid, org.organization.id);
  }
}
