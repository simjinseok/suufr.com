import { Module } from '@nestjs/common';
import { CurriculumsController } from './curriculums.controller';
import { CurriculumsService } from './curriculums.service';
import { StorageModule } from '../storage/storage.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [StorageModule, S3Module],
  controllers: [CurriculumsController],
  providers: [CurriculumsService],
  exports: [CurriculumsService],
})
export class CurriculumsModule {}
