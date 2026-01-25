import { Module } from '@nestjs/common';
import { CurriculumsController } from './curriculums.controller';
import { CurriculumsService } from './curriculums.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [CurriculumsController],
  providers: [CurriculumsService],
  exports: [CurriculumsService],
})
export class CurriculumsModule {}
