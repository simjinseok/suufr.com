import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { StudentStatusesService } from './student-statuses.service';
import { CreateStudentStatusDto, UpdateStudentStatusDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller()
export class StudentStatusesController {
  constructor(private readonly studentStatusesService: StudentStatusesService) {}

  @Get('students/:studentUuid/statuses')
  findByStudent(
    @Param('studentUuid') studentUuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentStatusesService.findByStudent(studentUuid, user.userId);
  }

  @Post('students/:studentUuid/statuses')
  create(
    @Param('studentUuid') studentUuid: string,
    @Body() dto: CreateStudentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentStatusesService.create(studentUuid, dto, user.userId);
  }

  @Patch('student-statuses/:uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateStudentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentStatusesService.update(uuid, dto, user.userId);
  }
}
