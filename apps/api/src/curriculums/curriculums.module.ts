import { Module } from '@nestjs/common';
import { CurriculumsController } from './curriculums.controller';
import { CurriculumsService } from './curriculums.service';

@Module({
  controllers: [CurriculumsController],
  providers: [CurriculumsService],
  exports: [CurriculumsService],
})
export class CurriculumsModule {}
