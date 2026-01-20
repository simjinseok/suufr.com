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
      },
      create: {
        userId,
        ...(dto.use24HourFormat !== undefined && { use24HourFormat: dto.use24HourFormat }),
        ...(dto.defaultDuration !== undefined && { defaultDuration: dto.defaultDuration }),
        ...(dto.autoUpdateNextPaymentAt !== undefined && { autoUpdateNextPaymentAt: dto.autoUpdateNextPaymentAt }),
      },
    });

    return { success: true, data: settings };
  }
}
