import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
      });
    }

    return { success: true, data: settings };
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(dto.use24HourFormat !== undefined && { use24HourFormat: dto.use24HourFormat }),
        ...(dto.defaultDuration !== undefined && { defaultDuration: dto.defaultDuration }),
        ...(dto.autoUpdateNextPaymentAt !== undefined && { autoUpdateNextPaymentAt: dto.autoUpdateNextPaymentAt }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      },
      create: {
        userId,
        ...(dto.use24HourFormat !== undefined && { use24HourFormat: dto.use24HourFormat }),
        ...(dto.defaultDuration !== undefined && { defaultDuration: dto.defaultDuration }),
        ...(dto.autoUpdateNextPaymentAt !== undefined && { autoUpdateNextPaymentAt: dto.autoUpdateNextPaymentAt }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      },
    });

    return { success: true, data: settings };
  }

  /**
   * 경계 계산에 쓸 타임존 해석: 명시 파라미터 > 유저 설정 > UTC.
   */
  async resolveTimezone(userId: string, explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return settings?.timezone ?? 'UTC';
  }
}
