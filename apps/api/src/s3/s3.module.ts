import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ProfileImageService } from './profile-image.service';

@Module({
  providers: [S3Service, ProfileImageService],
  exports: [S3Service, ProfileImageService],
})
export class S3Module {}
