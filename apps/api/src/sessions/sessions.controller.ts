import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, UpdateSessionDto, UpsertFeedbackDto, ListSessionsQueryDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('api/sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll(
    @Query() query: ListSessionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.findAll(query, user.userId);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.findOne(uuid, user.userId);
  }

  @Post()
  create(
    @Body() createSessionDto: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.create(createSessionDto, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateSessionDto: UpdateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.update(uuid, updateSessionDto, user.userId);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.remove(uuid, user.userId);
  }

  @Patch(':uuid/done')
  markDone(
    @Param('uuid') uuid: string,
    @Body('isDone') isDone: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.markDone(uuid, isDone ?? true, user.userId);
  }

  @Post(':uuid/feedback')
  upsertFeedback(
    @Param('uuid') uuid: string,
    @Body() dto: UpsertFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.upsertFeedback(uuid, dto, user.userId);
  }

  @Delete(':uuid/feedback')
  deleteFeedback(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.deleteFeedback(uuid, user.userId);
  }
}
