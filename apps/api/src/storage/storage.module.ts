import { Module } from '@nestjs/common';
import { StorageQuotaService } from './storage-quota.service';
import { StorageController } from './storage.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  controllers: [StorageController],
  providers: [StorageQuotaService],
  exports: [StorageQuotaService],
})
export class StorageModule {}
