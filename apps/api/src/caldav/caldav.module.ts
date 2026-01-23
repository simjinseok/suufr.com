import { Module } from '@nestjs/common';
import { CaldavController } from './caldav.controller';
import { CaldavService } from './caldav.service';
import { ICalendarService } from './services/icalendar.service';
import { CaldavXmlBuilderService } from './services/caldav-xml-builder.service';
import { CaldavAuthGuard } from './guards/caldav-auth.guard';
import { AppTokensModule } from '../app-tokens/app-tokens.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AppTokensModule],
  controllers: [CaldavController],
  providers: [
    CaldavService,
    ICalendarService,
    CaldavXmlBuilderService,
    CaldavAuthGuard,
  ],
})
export class CaldavModule {}
