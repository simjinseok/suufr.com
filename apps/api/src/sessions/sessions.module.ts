import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { StorageModule } from '../storage/storage.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [StorageModule, GoogleModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
