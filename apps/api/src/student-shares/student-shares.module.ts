import { Module } from '@nestjs/common';
import { StudentSharesController, LegacyLessonSharesController } from './student-shares.controller';
import { StudentSharesService } from './student-shares.service';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [StudentSharesController, LegacyLessonSharesController],
  providers: [StudentSharesService],
  exports: [StudentSharesService],
})
export class StudentSharesModule {}
