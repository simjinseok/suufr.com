import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, UpdateSessionDto, UpsertFeedbackDto } from './dto';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll(
    @Query('organizationId') organizationId?: number,
    @Query('memberId') memberId?: number,
  ) {
    return this.sessionsService.findAll(organizationId, memberId);
  }

  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.sessionsService.findOne(uuid);
  }

  @Post()
  create(
    @Body() createSessionDto: CreateSessionDto,
    @Query('organizationId') organizationId: number,
    @Query('memberId') memberId: number,
  ) {
    return this.sessionsService.create(createSessionDto, organizationId, memberId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateSessionDto: UpdateSessionDto,
  ) {
    return this.sessionsService.update(uuid, updateSessionDto);
  }

  @Delete(':uuid')
  remove(@Param('uuid') uuid: string) {
    return this.sessionsService.remove(uuid);
  }

  @Patch(':uuid/done')
  markDone(
    @Param('uuid') uuid: string,
    @Body('isDone') isDone: boolean,
  ) {
    return this.sessionsService.markDone(uuid, isDone ?? true);
  }

  @Post(':uuid/feedback')
  upsertFeedback(
    @Param('uuid') uuid: string,
    @Body() dto: UpsertFeedbackDto,
  ) {
    return this.sessionsService.upsertFeedback(uuid, dto);
  }

  @Delete(':uuid/feedback')
  deleteFeedback(@Param('uuid') uuid: string) {
    return this.sessionsService.deleteFeedback(uuid);
  }
}
