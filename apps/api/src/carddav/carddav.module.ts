import { Module } from '@nestjs/common';
import { CarddavController } from './carddav.controller';
import { CarddavService } from './carddav.service';
import { VcardService } from './services/vcard.service';
import { XmlBuilderService } from './services/xml-builder.service';
import { CarddavAuthGuard } from './guards/carddav-auth.guard';
import { AppTokensModule } from '../app-tokens/app-tokens.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AppTokensModule],
  controllers: [CarddavController],
  providers: [
    CarddavService,
    VcardService,
    XmlBuilderService,
    CarddavAuthGuard,
  ],
})
export class CarddavModule {}
