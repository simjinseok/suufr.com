import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { StudentStatusesService } from './student-statuses.service';
import { CreateStudentStatusDto, UpdateStudentStatusDto } from './dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';

@Controller()
export class StudentStatusesController {
  constructor(private readonly studentStatusesService: StudentStatusesService) {}

  @Get('students/:studentUuid/statuses')
  findByStudent(
    @Param('studentUuid') studentUuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentStatusesService.findByStudent(studentUuid, org.organization.id);
  }

  @Post('students/:studentUuid/statuses')
  create(
    @Param('studentUuid') studentUuid: string,
    @Body() dto: CreateStudentStatusDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentStatusesService.create(studentUuid, dto, org.organization.id);
  }

  @Patch('student-statuses/:uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateStudentStatusDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentStatusesService.update(uuid, dto, org.organization.id);
  }
}
