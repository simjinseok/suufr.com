import { Module } from '@nestjs/common';
import { StudentStatusesController } from './student-statuses.controller';
import { StudentStatusesService } from './student-statuses.service';

@Module({
  controllers: [StudentStatusesController],
  providers: [StudentStatusesService],
  exports: [StudentStatusesService],
})
export class StudentStatusesModule {}
