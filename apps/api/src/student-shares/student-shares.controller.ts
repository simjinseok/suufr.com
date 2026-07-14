import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { StudentSharesService } from './student-shares.service';
import { CreateStudentShareDto } from './dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

@Controller('api/student-shares')
export class StudentSharesController {
  constructor(private readonly studentSharesService: StudentSharesService) {}

  @Get()
  findAllByStudent(
    @Query('studentUuid') studentUuid: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentSharesService.findAllByStudent(studentUuid, user.userId);
  }

  @Get(':shareId')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  getByShareId(@Param('shareId') shareId: string) {
    return this.studentSharesService.getByShareId(shareId);
  }

  @Post()
  create(
    @Body() createStudentShareDto: CreateStudentShareDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentSharesService.create(createStudentShareDto, user.userId);
  }

  @Delete(':shareId')
  remove(
    @Param('shareId') shareId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentSharesService.remove(shareId, user.userId);
  }
}

/**
 * [레거시] 구 LessonShare 공개 링크 호환 — 링크는 최대 7일 만료.
 * lessons drop 마이그레이션 때 이 컨트롤러와 서비스 메서드를 함께 제거한다.
 */
@Controller('api/lessons')
export class LegacyLessonSharesController {
  constructor(private readonly studentSharesService: StudentSharesService) {}

  @Get('share/:shareId')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  getByShareId(@Param('shareId') shareId: string) {
    return this.studentSharesService.getByLegacyLessonShareId(shareId);
  }
}
