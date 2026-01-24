import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { GoogleContactsService } from './services/google-contacts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GoogleController],
  providers: [
    GoogleService,
    GoogleCalendarService,
    GoogleContactsService,
  ],
  exports: [GoogleService, GoogleCalendarService, GoogleContactsService],
})
export class GoogleModule {}
