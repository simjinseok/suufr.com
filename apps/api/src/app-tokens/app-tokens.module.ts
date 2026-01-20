import { Module } from '@nestjs/common';
import { AppTokensController } from './app-tokens.controller';
import { AppTokensService } from './app-tokens.service';

@Module({
  controllers: [AppTokensController],
  providers: [AppTokensService],
  exports: [AppTokensService],
})
export class AppTokensModule {}
