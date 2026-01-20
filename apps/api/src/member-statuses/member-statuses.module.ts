import { Module } from '@nestjs/common';
import { MemberStatusesController } from './member-statuses.controller';
import { MemberStatusesService } from './member-statuses.service';

@Module({
  controllers: [MemberStatusesController],
  providers: [MemberStatusesService],
  exports: [MemberStatusesService],
})
export class MemberStatusesModule {}
