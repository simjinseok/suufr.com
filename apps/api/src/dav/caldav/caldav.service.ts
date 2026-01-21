import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { sessionToIcal, parseIcal } from '../lib/ical';
import { generateEtag } from '../lib/etag';

@Injectable()
export class CaldavService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllSessions(userId: string, organizationId: number) {
    return this.prisma.session.findMany({
      where: {
        lesson: {
          student: {
            organizationId,
            deletedAt: null,
          },
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
      },
      orderBy: { sessionAt: 'desc' },
    });
  }

  async findSessionByUuid(uuid: string, userId: string, organizationId: number) {
    return this.prisma.session.findFirst({
      where: {
        uuid,
        lesson: {
          student: {
            organizationId,
            deletedAt: null,
          },
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  async findSessionsByUuids(uuids: string[], userId: string, organizationId: number) {
    return this.prisma.session.findMany({
      where: {
        uuid: { in: uuids },
        lesson: {
          student: {
            organizationId,
            deletedAt: null,
          },
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  async updateSession(
    uuid: string,
    userId: string,
    organizationId: number,
    icalData: string,
  ) {
    const session = await this.findSessionByUuid(uuid, userId, organizationId);
    if (!session) return null;

    const parsed = parseIcal(icalData);

    const updateData: { sessionAt?: Date; duration?: number; notes?: string } = {};

    if (parsed.dtstart) {
      updateData.sessionAt = parsed.dtstart;
    }

    if (parsed.duration) {
      updateData.duration = parsed.duration;
    }

    if (parsed.description !== undefined) {
      updateData.notes = parsed.description;
    }

    return this.prisma.session.update({
      where: { id: session.id },
      data: updateData,
      include: {
        lesson: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  sessionToIcal(session: Awaited<ReturnType<typeof this.findSessionByUuid>>) {
    if (!session) return null;
    return sessionToIcal(session);
  }

  generateEtag(session: { id: number; updatedAt: Date }) {
    return generateEtag(session.id, session.updatedAt);
  }
}
