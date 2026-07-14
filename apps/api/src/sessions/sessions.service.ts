import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { CreateSessionsBulkDto } from './dto/create-sessions-bulk.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { UpsertFeedbackDto } from './dto/feedback.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { Prisma } from '@prisma/generated/client';
import { GoogleCalendarService } from '../google/services/google-calendar.service';
import { SettingsService } from '../settings/settings.service';
import { zonedParts } from '../common/utils/timezone';

const MAX_MEDIA_FILES_PER_SESSION = 5;

// 목록/상세 공통 include
const SESSION_INCLUDE = {
  student: true,
  invoice: {
    select: { uuid: true, title: true, price: true, deletedAt: true },
  },
  feedback: true,
  sessionMediaFiles: {
    orderBy: { createdAt: 'asc' as const },
    include: { mediaFile: true },
  },
} satisfies Prisma.SessionInclude;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Sync session to Google Calendar in background (fire-and-forget)
   */
  private syncToGoogleCalendar(sessionId: number, userId: string, action: 'push' | 'delete'): void {
    setImmediate(() => {
      const promise = action === 'push'
        ? this.googleCalendarService.pushSession(sessionId, userId)
        : this.googleCalendarService.deleteSession(sessionId, userId);

      promise.catch((err) => {
        this.logger.error(`Failed to ${action} session ${sessionId} to Google Calendar:`, err);
      });
    });
  }

  /**
   * 기간 정액(totalCount 없는) 청구의 날짜 기반 자동 귀속 (docs/schema-redesign.md §3).
   * 사용자 타임존 기준 세션 날짜를 기간이 커버하는 살아있는 청구를 찾는다.
   * 회차 수강권(totalCount 있음)은 명시 귀속만 — 잔여 회차 초과 방지.
   */
  private async findCoveringInvoiceId(studentId: number, sessionAt: Date, timeZone: string): Promise<number | null> {
    const { year, month, day } = zonedParts(sessionAt, timeZone);
    // periodStart/periodEnd는 @db.Date — 달력 날짜를 UTC 자정으로 맞춰 비교한다
    const sessionDate = new Date(Date.UTC(year, month - 1, day));

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        studentId,
        deletedAt: null,
        totalCount: null,
        periodStart: { lte: sessionDate },
        periodEnd: { gte: sessionDate },
      },
      orderBy: { periodStart: 'desc' },
      select: { id: true },
    });

    return invoice?.id ?? null;
  }

  async findAll(query: ListSessionsQueryDto, userId: string) {
    // 사용자가 소유한 모든 organization 조회
    const organizations = await this.prisma.organization.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, uuid: true },
    });
    const userOrgUuids = organizations.map(o => o.uuid);
    const userOrgIds = organizations.map(o => o.id);

    // organizationUuids가 지정되면 사용자가 소유한 organization만 필터링
    let orgIds: number[];
    if (query.organizationUuids && query.organizationUuids.length > 0) {
      const filteredUuids = query.organizationUuids.filter(uuid => userOrgUuids.includes(uuid));
      orgIds = organizations
        .filter(o => filteredUuids.includes(o.uuid))
        .map(o => o.id);
    }
    else {
      orgIds = userOrgIds;
    }

    const { page = 1, limit = 20, studentUuid, invoiceUuid, dateFrom, dateTo, order = 'asc' } = query;
    const skip = (page - 1) * limit;

    // studentUuid로 필터링 시 student의 organizationId 검증
    let studentId: number | undefined;
    if (studentUuid) {
      const student = await this.prisma.student.findUnique({
        where: { uuid: studentUuid },
        select: { id: true, organizationId: true, deletedAt: true },
      });
      if (student && !student.deletedAt && orgIds.includes(student.organizationId)) {
        studentId = student.id;
      }
      else {
        return {
          success: true,
          data: [],
          meta: { page, limit, totalCount: 0, totalPages: 0 },
        };
      }
    }

    // invoiceUuid로 필터링 시 invoice의 organizationId 검증
    let invoiceId: number | undefined;
    if (invoiceUuid) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { uuid: invoiceUuid },
        include: { student: { select: { organizationId: true } } },
      });
      if (invoice && !invoice.deletedAt && orgIds.includes(invoice.student.organizationId)) {
        invoiceId = invoice.id;
      }
      else {
        return {
          success: true,
          data: [],
          meta: { page, limit, totalCount: 0, totalPages: 0 },
        };
      }
    }

    const where: Prisma.SessionWhereInput = {
      deletedAt: null,
      ...(studentId && { studentId }),
      ...(invoiceId && { invoiceId }),
      ...(dateFrom || dateTo) && {
        sessionAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      },
      student: {
        deletedAt: null,
        organizationId: { in: orgIds },
      },
    };

    const [sessions, totalCount] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: { sessionAt: order },
        skip,
        take: limit,
      }),
      this.prisma.session.count({ where }),
    ]);

    return {
      success: true,
      data: sessions,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(uuid: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: SESSION_INCLUDE,
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    return { success: true, data: session };
  }

  async create(dto: CreateSessionDto, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid: dto.studentUuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${dto.studentUuid} not found`);
    }

    // 명시 귀속: 청구가 같은 학생 소유인지 검증
    let invoiceId: number | null = null;
    if (dto.invoiceUuid) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          uuid: dto.invoiceUuid,
          studentId: student.id,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with UUID ${dto.invoiceUuid} not found`);
      }
      invoiceId = invoice.id;
    }
    else {
      // 기간 정액 청구는 날짜 기준 자동 귀속
      const timeZone = await this.settingsService.resolveTimezone(userId, dto.timezone);
      invoiceId = await this.findCoveringInvoiceId(student.id, new Date(dto.sessionAt), timeZone);
    }

    // 미디어 파일 개수 제한 체크
    const totalMediaFiles = dto.mediaFileUuids?.length ?? 0;
    if (totalMediaFiles > MAX_MEDIA_FILES_PER_SESSION) {
      throw new BadRequestException(
        `세션당 최대 ${MAX_MEDIA_FILES_PER_SESSION}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 파일 소유권 확인
    let mediaFiles: { id: number }[] = [];
    if (dto.mediaFileUuids && dto.mediaFileUuids.length > 0) {
      mediaFiles = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.mediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (mediaFiles.length !== dto.mediaFileUuids.length) {
        throw new BadRequestException('일부 파일을 찾을 수 없거나 권한이 없습니다.');
      }
    }

    // 트랜잭션으로 DB 작업 수행
    const session = await this.prisma.$transaction(async (tx) => {
      // Session 생성
      const newSession = await tx.session.create({
        data: {
          sessionAt: new Date(dto.sessionAt),
          duration: dto.duration ?? 60,
          notes: dto.notes ?? '',
          studentId: student.id,
          invoiceId,
        },
      });

      // 파일 연결
      for (const mediaFile of mediaFiles) {
        await tx.sessionMediaFile.create({
          data: {
            sessionId: newSession.id,
            mediaFileId: mediaFile.id,
          },
        });
      }

      return newSession;
    });

    // 구글 캘린더에 백그라운드 동기화
    this.syncToGoogleCalendar(session.id, userId, 'push');

    // 생성된 세션 조회하여 반환
    return this.findOne(session.uuid, userId);
  }

  /**
   * 여러 수업을 한 번에 생성 (요일·시간·횟수로 계산된 목록).
   * 부분 생성이 남지 않도록 createMany로 한 번에 넣는다.
   */
  async createMany(dto: CreateSessionsBulkDto, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid: dto.studentUuid,
        deletedAt: null,
        organization: { userId, deletedAt: null },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with UUID ${dto.studentUuid} not found`);
    }

    // 명시 귀속: 청구가 같은 학생 소유인지 검증
    let invoiceId: number | null = null;
    if (dto.invoiceUuid) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          uuid: dto.invoiceUuid,
          studentId: student.id,
          deletedAt: null,
        },
        select: { id: true, totalCount: true },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with UUID ${dto.invoiceUuid} not found`);
      }

      // 회차 수강권은 잔여 회차를 넘겨 만들지 않는다
      if (invoice.totalCount != null && invoice.totalCount > 0) {
        const attached = await this.prisma.session.count({
          where: { invoiceId: invoice.id, deletedAt: null },
        });
        const remaining = invoice.totalCount - attached;
        if (dto.sessions.length > remaining) {
          throw new BadRequestException(
            `남은 회차(${Math.max(remaining, 0)}회)보다 많은 수업을 만들 수 없습니다.`,
          );
        }
      }

      invoiceId = invoice.id;
    }

    const timeZone = await this.settingsService.resolveTimezone(userId, dto.timezone);

    const data = await Promise.all(dto.sessions.map(async (s) => {
      const sessionAt = new Date(s.sessionAt);
      return {
        sessionAt,
        duration: s.duration ?? 60,
        notes: s.notes ?? '',
        studentId: student.id,
        // 명시 귀속이 없으면 기간 정액 청구에 날짜 기준 자동 귀속
        invoiceId: invoiceId ?? await this.findCoveringInvoiceId(student.id, sessionAt, timeZone),
      };
    }));

    const created = await this.prisma.session.createManyAndReturn({
      data,
      select: { id: true, uuid: true },
    });

    // 다음 결제 예정일 자동 갱신 — 마지막 수업 다음 회차 날짜 (클라이언트가 같은 패턴으로 계산해 보낸다)
    if (dto.nextPaymentAt) {
      const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
      if (settings?.autoUpdateNextPaymentAt ?? true) {
        const [year, month, day] = dto.nextPaymentAt.slice(0, 10).split('-').map(Number);
        await this.prisma.student.update({
          where: { id: student.id },
          data: { nextPaymentAt: new Date(Date.UTC(year, month - 1, day)) },
        });
      }
    }

    // 구글 캘린더에 백그라운드 동기화
    for (const session of created) {
      this.syncToGoogleCalendar(session.id, userId, 'push');
    }

    const sessions = await this.prisma.session.findMany({
      where: { id: { in: created.map(s => s.id) } },
      orderBy: { sessionAt: 'asc' },
      include: SESSION_INCLUDE,
    });

    return { success: true, data: sessions };
  }

  async update(uuid: string, dto: UpdateSessionDto, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: {
        sessionMediaFiles: {
          include: { mediaFile: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    // 청구 재귀속: 같은 학생 소유인지 검증
    let invoiceId: number | undefined;
    if (dto.invoiceUuid) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          uuid: dto.invoiceUuid,
          studentId: session.studentId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!invoice) {
        throw new NotFoundException(`Invoice with UUID ${dto.invoiceUuid} not found`);
      }
      invoiceId = invoice.id;
    }

    // 현재 파일 수 계산
    const currentFileCount = session.sessionMediaFiles.length;
    const removeCount = dto.removeMediaFileUuids?.length ?? 0;
    const addCount = dto.addMediaFileUuids?.length ?? 0;
    const newTotalCount = currentFileCount - removeCount + addCount;

    if (newTotalCount > MAX_MEDIA_FILES_PER_SESSION) {
      throw new BadRequestException(
        `세션당 최대 ${MAX_MEDIA_FILES_PER_SESSION}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 추가할 파일 소유권 확인
    let filesToAdd: { id: number }[] = [];
    if (dto.addMediaFileUuids && dto.addMediaFileUuids.length > 0) {
      filesToAdd = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.addMediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (filesToAdd.length !== dto.addMediaFileUuids.length) {
        throw new BadRequestException('일부 파일을 찾을 수 없거나 권한이 없습니다.');
      }
    }

    // 삭제할 파일들 조회
    let filesToRemove: typeof session.sessionMediaFiles = [];
    if (dto.removeMediaFileUuids && dto.removeMediaFileUuids.length > 0) {
      filesToRemove = session.sessionMediaFiles.filter((smf) =>
        dto.removeMediaFileUuids!.includes(smf.mediaFile.uuid),
      );
    }

    // 트랜잭션으로 DB 작업 수행
    await this.prisma.$transaction(async (tx) => {
      // Session 업데이트
      await tx.session.update({
        where: { uuid },
        data: {
          ...(dto.sessionAt !== undefined && { sessionAt: new Date(dto.sessionAt) }),
          ...(dto.duration !== undefined && { duration: dto.duration }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.isDone !== undefined && { isDone: dto.isDone }),
          ...(invoiceId !== undefined && { invoiceId }),
        },
      });

      // 파일 연결 해제 (hard delete)
      for (const smf of filesToRemove) {
        await tx.sessionMediaFile.delete({
          where: { id: smf.id },
        });
      }

      // 파일 연결
      for (const fileToAdd of filesToAdd) {
        const existingLink = await tx.sessionMediaFile.findFirst({
          where: {
            sessionId: session.id,
            mediaFileId: fileToAdd.id,
          },
        });

        if (!existingLink) {
          await tx.sessionMediaFile.create({
            data: {
              sessionId: session.id,
              mediaFileId: fileToAdd.id,
            },
          });
        }
      }
    });

    // 구글 캘린더에 백그라운드 동기화
    this.syncToGoogleCalendar(session.id, userId, 'push');

    // 업데이트된 세션 조회하여 반환
    return this.findOne(uuid, userId);
  }

  async remove(uuid: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    await this.prisma.session.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    // 구글 캘린더에서 백그라운드 삭제
    this.syncToGoogleCalendar(session.id, userId, 'delete');

    return { success: true };
  }

  async markDone(uuid: string, isDone: boolean, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    const updatedSession = await this.prisma.session.update({
      where: { uuid },
      data: { isDone },
      include: SESSION_INCLUDE,
    });

    return { success: true, data: updatedSession };
  }

  async upsertFeedback(uuid: string, dto: UpsertFeedbackDto, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: {
        feedback: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    let feedback;
    if (session.feedback) {
      feedback = await this.prisma.feedback.update({
        where: { id: session.feedback.id },
        data: { notes: dto.notes },
      });
    }
    else {
      feedback = await this.prisma.feedback.create({
        data: {
          notes: dto.notes,
          sessionId: session.id,
        },
      });
    }

    return { success: true, data: feedback };
  }

  async deleteFeedback(uuid: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: {
        feedback: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    if (!session.feedback) {
      throw new NotFoundException('Feedback not found');
    }

    // 피드백 soft delete
    await this.prisma.feedback.update({
      where: { id: session.feedback.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
