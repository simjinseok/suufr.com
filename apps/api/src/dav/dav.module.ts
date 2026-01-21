import { Module } from '@nestjs/common';
import { DavController } from './dav.controller';
import { PrincipalsController } from './principals/principals.controller';
import { CaldavController } from './caldav/caldav.controller';
import { CaldavService } from './caldav/caldav.service';
import { CarddavController } from './carddav/carddav.controller';
import { CarddavService } from './carddav/carddav.service';
import { BasicAuthGuard } from './auth/basic-auth.guard';
import { AppTokensModule } from '../app-tokens/app-tokens.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AppTokensModule, PrismaModule],
  controllers: [
    DavController,
    PrincipalsController,
    CaldavController,
    CarddavController,
  ],
  providers: [BasicAuthGuard, CaldavService, CarddavService],
})
export class DavModule {}
