import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { CarddavModule } from './carddav/carddav.module';
import { CaldavModule } from './caldav/caldav.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StudentsModule } from './students/students.module';
import { LessonsModule } from './lessons/lessons.module';
import { SessionsModule } from './sessions/sessions.module';
import { PaymentsModule } from './payments/payments.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MeetingsModule } from './meetings/meetings.module';
import { StudentStatusesModule } from './student-statuses/student-statuses.module';
import { StudentCommentsModule } from './student-comments/student-comments.module';
import { SettingsModule } from './settings/settings.module';
import { AppTokensModule } from './app-tokens/app-tokens.module';
import { GoogleModule } from './google/google.module';
import { StorageModule } from './storage/storage.module';
import { CurriculumsModule } from './curriculums/curriculums.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    HealthModule,
    DashboardModule,
    StudentsModule,
    LessonsModule,
    SessionsModule,
    PaymentsModule,
    OrganizationsModule,
    MeetingsModule,
    StudentStatusesModule,
    StudentCommentsModule,
    SettingsModule,
    AppTokensModule,
    CarddavModule,
    CaldavModule,
    GoogleModule,
    StorageModule,
    CurriculumsModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
