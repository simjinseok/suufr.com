import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  findAll(
    @Query() query: ListStudentsQueryDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentsService.findAll(org.organization.id, query);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentsService.findOne(uuid, org.organization.id);
  }

  @Get(':uuid/stats')
  getStats(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentsService.getStats(uuid, org.organization.id);
  }

  @Post()
  create(
    @Body() createStudentDto: CreateStudentDto,
    @CurrentOrganization() org: CurrentOrganizationData,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentsService.create(createStudentDto, org.organization.id, user.userId);
  }

  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentsService.update(uuid, updateStudentDto, org.organization.id);
  }

  @Delete(':uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentsService.remove(uuid, org.organization.id);
  }
}
