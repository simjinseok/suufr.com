import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto, UpdateMeetingDto, ListMeetingsQueryDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  findAll(
    @Query() query: ListMeetingsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.findAll(query, user.userId);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.findOne(uuid, user.userId);
  }

  @Post()
  create(
    @Body() createMeetingDto: CreateMeetingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.create(createMeetingDto, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateMeetingDto: UpdateMeetingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.update(uuid, updateMeetingDto, user.userId);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.remove(uuid, user.userId);
  }
}
