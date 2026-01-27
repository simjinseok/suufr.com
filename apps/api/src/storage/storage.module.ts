import { Module } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { FolderService } from './folder.service';
import { StorageController } from './storage.controller';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [StorageController],
  providers: [StorageQuotaService, FolderService],
  exports: [StorageQuotaService, FolderService],
})
export class StorageModule {}
