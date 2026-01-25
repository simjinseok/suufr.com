import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { GoogleContactsService } from './services/google-contacts.service';
import { GoogleSchedulerService } from './google-scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [GoogleController],
  providers: [
    GoogleService,
    GoogleCalendarService,
    GoogleContactsService,
    GoogleSchedulerService,
  ],
  exports: [GoogleService, GoogleCalendarService, GoogleContactsService],
})
export class GoogleModule {}
