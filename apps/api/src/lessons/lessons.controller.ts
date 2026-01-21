import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, UpdateLessonDto, ListLessonsQueryDto } from './dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  findAll(
    @Query() query: ListLessonsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.findAll(query, user.userId);
  }

  @Get('share/:shareId')
  @Public()
  getByShareId(@Param('shareId') shareId: string) {
    return this.lessonsService.getByShareId(shareId);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.findOne(uuid, user.userId);
  }

  @Post()
  create(
    @Body() createLessonDto: CreateLessonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.create(createLessonDto, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateLessonDto: UpdateLessonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.update(uuid, updateLessonDto, user.userId);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.remove(uuid, user.userId);
  }

  @Post(':uuid/share')
  createShare(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.createShare(uuid, user.userId);
  }

  @Delete(':uuid/share/:shareId')
  deleteShare(
    @Param('uuid') uuid: string,
    @Param('shareId') shareId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lessonsService.deleteShare(uuid, shareId, user.userId);
  }
}
