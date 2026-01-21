import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, UpdateLessonDto } from './dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  findAll(
    @Query('organizationId') organizationId?: number,
    @Query('memberId') memberId?: number,
  ) {
    return this.lessonsService.findAll(organizationId, memberId);
  }

  @Get('share/:shareId')
  @Public()
  getByShareId(@Param('shareId') shareId: string) {
    return this.lessonsService.getByShareId(shareId);
  }

  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.lessonsService.findOne(uuid);
  }

  @Post()
  create(
    @Body() createLessonDto: CreateLessonDto,
    @Query('organizationId') organizationId: number,
    @Query('memberId') memberId: number,
  ) {
    return this.lessonsService.create(createLessonDto, organizationId, memberId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateLessonDto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(uuid, updateLessonDto);
  }

  @Delete(':uuid')
  remove(@Param('uuid') uuid: string) {
    return this.lessonsService.remove(uuid);
  }

  @Post(':uuid/share')
  createShare(@Param('uuid') uuid: string) {
    return this.lessonsService.createShare(uuid);
  }
}
