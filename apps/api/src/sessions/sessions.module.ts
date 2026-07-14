import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GoogleModule, SettingsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
