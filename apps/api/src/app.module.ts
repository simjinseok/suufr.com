import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StudentsModule } from './students/students.module';
import { LessonsModule } from './lessons/lessons.module';
import { SessionsModule } from './sessions/sessions.module';
import { PaymentsModule } from './payments/payments.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MembersModule } from './members/members.module';
import { MeetingsModule } from './meetings/meetings.module';
import { StudentStatusesModule } from './student-statuses/student-statuses.module';
import { StudentCommentsModule } from './student-comments/student-comments.module';
import { MemberStatusesModule } from './member-statuses/member-statuses.module';
import { SettingsModule } from './settings/settings.module';
import { AppTokensModule } from './app-tokens/app-tokens.module';
import { DavModule } from './dav/dav.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    CommonModule,
    HealthModule,
    DashboardModule,
    StudentsModule,
    LessonsModule,
    SessionsModule,
    PaymentsModule,
    OrganizationsModule,
    MembersModule,
    MeetingsModule,
    StudentStatusesModule,
    StudentCommentsModule,
    MemberStatusesModule,
    SettingsModule,
    AppTokensModule,
    DavModule,
  ],
})
export class AppModule {}
