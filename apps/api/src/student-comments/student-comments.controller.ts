import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { StudentCommentsService } from './student-comments.service';
import { CreateStudentCommentDto, UpdateStudentCommentDto } from './dto';
import { CurrentOrganization, CurrentOrganizationData } from '../common/decorators/current-organization.decorator';

@Controller()
export class StudentCommentsController {
  constructor(private readonly studentCommentsService: StudentCommentsService) {}

  @Get('students/:studentUuid/comments')
  findByStudent(
    @Param('studentUuid') studentUuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentCommentsService.findByStudent(studentUuid, org.organization.id);
  }

  @Post('students/:studentUuid/comments')
  create(
    @Param('studentUuid') studentUuid: string,
    @Body() dto: CreateStudentCommentDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentCommentsService.create(studentUuid, dto, org.organization.id);
  }

  @Patch('student-comments/:uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateStudentCommentDto,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentCommentsService.update(uuid, dto, org.organization.id);
  }

  @Delete('student-comments/:uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentOrganization() org: CurrentOrganizationData,
  ) {
    return this.studentCommentsService.remove(uuid, org.organization.id);
  }
}
