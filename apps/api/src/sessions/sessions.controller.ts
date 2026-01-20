import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, UpdateSessionDto, UpsertFeedbackDto } from './dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll(@CurrentOrganization() org: CurrentOrganizationData) {
    return this.sessionsService.findAll(org.organization.id, org.member.id);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.sessionsService.findOne(uuid, org.organization.id, org.member.id);
  }

  @Post()
  create(
    @Body() createSessionDto: CreateSessionDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.sessionsService.create(createSessionDto, org.organization.id, org.member.id);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateSessionDto: UpdateSessionDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.sessionsService.update(uuid, updateSessionDto, org.organization.id, org.member.id);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.sessionsService.remove(uuid, org.organization.id, org.member.id);
  }

  @Patch(':uuid/done')
  markDone(
    @Param('uuid') uuid: string,
    @Body('isDone') isDone: boolean,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.sessionsService.markDone(uuid, isDone ?? true, org.organization.id, org.member.id);
  }

  @Post(':uuid/feedback')
  upsertFeedback(
    @Param('uuid') uuid: string,
    @Body() dto: UpsertFeedbackDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.sessionsService.upsertFeedback(uuid, dto, org.organization.id, org.member.id);
  }

  @Delete(':uuid/feedback')
  deleteFeedback(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.sessionsService.deleteFeedback(uuid, org.organization.id, org.member.id);
  }
}
