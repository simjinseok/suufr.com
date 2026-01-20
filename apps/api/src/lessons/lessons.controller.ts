import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto, UpdateLessonDto } from './dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  findAll(@CurrentOrganization() org: CurrentOrganizationData) {
    return this.lessonsService.findAll(org.organization.id, org.member.id);
  }

  @Get('share/:shareId')
  @Public()
  getByShareId(@Param('shareId') shareId: string) {
    return this.lessonsService.getByShareId(shareId);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.lessonsService.findOne(uuid, org.organization.id, org.member.id);
  }

  @Post()
  create(
    @Body() createLessonDto: CreateLessonDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.lessonsService.create(createLessonDto, org.organization.id, org.member.id);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateLessonDto: UpdateLessonDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.lessonsService.update(uuid, updateLessonDto, org.organization.id, org.member.id);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.lessonsService.remove(uuid, org.organization.id, org.member.id);
  }

  @Post(':uuid/share')
  createShare(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.lessonsService.createShare(uuid, org.organization.id, org.member.id);
  }
}
