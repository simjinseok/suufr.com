import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  findAll(@CurrentOrganization() org: CurrentOrganizationData) {
    return this.studentsService.findAll(org.organization.id);
  }

  @Get(':uuid')
  findOne(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentsService.findOne(uuid, org.organization.id);
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
