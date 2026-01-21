import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { StudentCommentsService } from './student-comments.service';
import { CreateStudentCommentDto, UpdateStudentCommentDto } from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller()
export class StudentCommentsController {
  constructor(private readonly studentCommentsService: StudentCommentsService) {}

  @Get('students/:studentUuid/comments')
  findByStudent(
    @Param('studentUuid') studentUuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentCommentsService.findByStudent(studentUuid, user.userId);
  }

  @Post('students/:studentUuid/comments')
  create(
    @Param('studentUuid') studentUuid: string,
    @Body() dto: CreateStudentCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentCommentsService.create(studentUuid, dto, user.userId);
  }

  @Patch('student-comments/:uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateStudentCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentCommentsService.update(uuid, dto, user.userId);
  }

  @Delete('student-comments/:uuid')
  remove(
    @Param('uuid') uuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentCommentsService.remove(uuid, user.userId);
  }
}
