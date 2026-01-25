import { Module } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { StorageController } from './storage.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [CloudinaryModule, S3Module],
  controllers: [StorageController],
  providers: [StorageQuotaService],
  exports: [StorageQuotaService],
})
export class StorageModule {}
