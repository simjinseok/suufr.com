import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto, UpdateMeetingDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  findAll(@Query('organizationId') organizationId?: number) {
    return this.meetingsService.findAll(organizationId);
  }

  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.meetingsService.findOne(uuid);
  }

  @Post()
  create(
    @Body() createMeetingDto: CreateMeetingDto,
    @Query('organizationId') organizationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.create(createMeetingDto, organizationId, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateMeetingDto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(uuid, updateMeetingDto);
  }

  @Delete(':uuid')
  remove(@Param('uuid') uuid: string) {
    return this.meetingsService.remove(uuid);
  }
}
