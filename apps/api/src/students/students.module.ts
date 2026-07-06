import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { S3Module } from '../s3/s3.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [S3Module, SubscriptionsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
