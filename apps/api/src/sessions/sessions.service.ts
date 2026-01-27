import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto, CreateMediaFileDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { UpsertFeedbackDto } from './dto/feedback.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { Prisma } from '@prisma/generated/client';
import { S3Service } from '../s3/s3.service';
import { StorageQuotaService } from '../storage/storage-quota.service';
import { GoogleCalendarService } from '../google/services/google-calendar.service';

const MAX_MEDIA_FILES_PER_SESSION = 5;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly storageQuotaService: StorageQuotaService,
    private readonly googleCalendarService: GoogleCalendarService,
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

    const { page = 1, limit = 20, lessonUuid, dateFrom, dateTo } = query;
    const skip = (page - 1) * limit;

    // lessonUuid로 필터링 시 lesson의 organizationId 검증
    let lessonId: number | undefined;
    if (lessonUuid) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { uuid: lessonUuid },
        include: { student: { select: { organizationId: true } } },
      });
      if (lesson && !lesson.deletedAt && orgIds.includes(lesson.student.organizationId)) {
        lessonId = lesson.id;
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
      ...(lessonId && { lessonId }),
      ...(dateFrom || dateTo) && {
        sessionAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      },
      lesson: {
        deletedAt: null,
        student: {
          deletedAt: null,
          organizationId: { in: orgIds },
        },
      },
    };

    const [sessions, totalCount] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: {
          lesson: {
            include: { student: true },
          },
          feedback: {
            include: {
              feedbackMediaFiles: {
                orderBy: { createdAt: 'asc' },
                include: { mediaFile: true },
              },
            },
          },
          sessionMediaFiles: {
            orderBy: { createdAt: 'asc' },
            include: { mediaFile: true },
          },
        },
        orderBy: { sessionAt: 'asc' },
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
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
      },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: {
          include: {
            feedbackMediaFiles: {
              orderBy: { createdAt: 'asc' },
              include: { mediaFile: true },
            },
          },
        },
        sessionMediaFiles: {
          orderBy: { createdAt: 'asc' },
          include: { mediaFile: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    return { success: true, data: session };
  }

  async create(dto: CreateSessionDto, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        uuid: dto.lessonUuid,
        deletedAt: null,
        student: { organization: { userId, deletedAt: null } },
      },
      include: { student: true },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with UUID ${dto.lessonUuid} not found`);
    }

    // 미디어 파일 개수 제한 체크
    const totalMediaFiles
      = (dto.newMediaFiles?.length ?? 0) + (dto.existingMediaFileUuids?.length ?? 0);
    if (totalMediaFiles > MAX_MEDIA_FILES_PER_SESSION) {
      throw new BadRequestException(
        `세션당 최대 ${MAX_MEDIA_FILES_PER_SESSION}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 새 파일들의 용량 체크
    if (dto.newMediaFiles && dto.newMediaFiles.length > 0) {
      const totalSize = dto.newMediaFiles.reduce((sum, f) => sum + f.fileSize, 0);
      const canUpload = await this.storageQuotaService.canUpload(userId, totalSize);
      if (!canUpload) {
        throw new BadRequestException('스토리지 용량이 부족합니다.');
      }
    }

    // 기존 파일 재활용 시 소유권 확인
    let existingMediaFiles: { id: number }[] = [];
    if (dto.existingMediaFileUuids && dto.existingMediaFileUuids.length > 0) {
      existingMediaFiles = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.existingMediaFileUuids },
          userId, // 본인 소유만 재활용 가능
        },
        select: { id: true },
      });

      if (existingMediaFiles.length !== dto.existingMediaFileUuids.length) {
        throw new BadRequestException('일부 파일을 찾을 수 없거나 권한이 없습니다.');
      }
    }

    // 새 파일들 temp → 적절한 폴더로 이동 (contentType 기반)
    const movedFiles: { url: string; key: string; dto: CreateMediaFileDto }[] = [];
    if (dto.newMediaFiles) {
      for (const fileDto of dto.newMediaFiles) {
        const result = await this.s3Service.moveFileByContentType(fileDto.url, fileDto.contentType);
        if (!result) {
          throw new BadRequestException('파일 이동에 실패했습니다.');
        }
        movedFiles.push({ url: result.url, key: result.key, dto: fileDto });
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
          lessonId: lesson.id,
        },
      });

      // 새 MediaFile 레코드 생성 및 연결
      for (const moved of movedFiles) {
        const mediaFile = await tx.mediaFile.create({
          data: {
            url: moved.url,
            publicId: moved.key,
            type: moved.dto.type,
            fileName: moved.dto.fileName,
            fileSize: moved.dto.fileSize,
            userId,
          },
        });

        await tx.sessionMediaFile.create({
          data: {
            sessionId: newSession.id,
            mediaFileId: mediaFile.id,
          },
        });
      }

      // 기존 파일 연결
      for (const existingFile of existingMediaFiles) {
        await tx.sessionMediaFile.create({
          data: {
            sessionId: newSession.id,
            mediaFileId: existingFile.id,
          },
        });
      }

      // 용량 증가
      if (movedFiles.length > 0) {
        const totalSize = movedFiles.reduce((sum, f) => sum + f.dto.fileSize, 0);
        await this.storageQuotaService.increaseUsage(userId, totalSize);
      }

      return newSession;
    });

    // 구글 캘린더에 백그라운드 동기화
    this.syncToGoogleCalendar(session.id, userId, 'push');

    // 생성된 세션 조회하여 반환
    return this.findOne(session.uuid, userId);
  }

  async update(uuid: string, dto: UpdateSessionDto, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
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

    // 현재 파일 수 계산
    const currentFileCount = session.sessionMediaFiles.length;
    const removeCount = dto.removeMediaFileUuids?.length ?? 0;
    const addNewCount = dto.addNewMediaFiles?.length ?? 0;
    const addExistingCount = dto.addExistingMediaFileUuids?.length ?? 0;
    const newTotalCount = currentFileCount - removeCount + addNewCount + addExistingCount;

    if (newTotalCount > MAX_MEDIA_FILES_PER_SESSION) {
      throw new BadRequestException(
        `세션당 최대 ${MAX_MEDIA_FILES_PER_SESSION}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 새 파일들의 용량 체크
    if (dto.addNewMediaFiles && dto.addNewMediaFiles.length > 0) {
      const totalSize = dto.addNewMediaFiles.reduce((sum, f) => sum + f.fileSize, 0);
      const canUpload = await this.storageQuotaService.canUpload(userId, totalSize);
      if (!canUpload) {
        throw new BadRequestException('스토리지 용량이 부족합니다.');
      }
    }

    // 기존 파일 재활용 시 소유권 확인
    let existingMediaFiles: { id: number }[] = [];
    if (dto.addExistingMediaFileUuids && dto.addExistingMediaFileUuids.length > 0) {
      existingMediaFiles = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.addExistingMediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (existingMediaFiles.length !== dto.addExistingMediaFileUuids.length) {
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

    // 새 파일들 temp → 적절한 폴더로 이동 (contentType 기반)
    const movedFiles: { url: string; key: string; dto: CreateMediaFileDto }[] = [];
    if (dto.addNewMediaFiles) {
      for (const fileDto of dto.addNewMediaFiles) {
        const result = await this.s3Service.moveFileByContentType(fileDto.url, fileDto.contentType);
        if (!result) {
          throw new BadRequestException('파일 이동에 실패했습니다.');
        }
        movedFiles.push({ url: result.url, key: result.key, dto: fileDto });
      }
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
        },
      });

      // 파일 연결 해제 (hard delete)
      for (const smf of filesToRemove) {
        await tx.sessionMediaFile.delete({
          where: { id: smf.id },
        });
      }

      // 새 MediaFile 레코드 생성 및 연결
      for (const moved of movedFiles) {
        const mediaFile = await tx.mediaFile.create({
          data: {
            url: moved.url,
            publicId: moved.key,
            type: moved.dto.type,
            fileName: moved.dto.fileName,
            fileSize: moved.dto.fileSize,
            userId,
          },
        });

        await tx.sessionMediaFile.create({
          data: {
            sessionId: session.id,
            mediaFileId: mediaFile.id,
          },
        });
      }

      // 기존 파일 연결
      for (const existingFile of existingMediaFiles) {
        // 이미 연결되어 있는지 확인 (unique constraint로 인해 중복 방지)
        const existingLink = await tx.sessionMediaFile.findFirst({
          where: {
            sessionId: session.id,
            mediaFileId: existingFile.id,
          },
        });

        if (!existingLink) {
          await tx.sessionMediaFile.create({
            data: {
              sessionId: session.id,
              mediaFileId: existingFile.id,
            },
          });
        }
      }

      // 용량 증가
      if (movedFiles.length > 0) {
        const totalSize = movedFiles.reduce((sum, f) => sum + f.dto.fileSize, 0);
        await this.storageQuotaService.increaseUsage(userId, totalSize);
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
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
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
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    const updatedSession = await this.prisma.session.update({
      where: { uuid },
      data: { isDone },
      include: {
        lesson: {
          include: { student: true },
        },
        feedback: {
          include: {
            feedbackMediaFiles: {
              orderBy: { createdAt: 'asc' },
              include: { mediaFile: true },
            },
          },
        },
        sessionMediaFiles: {
          orderBy: { createdAt: 'asc' },
          include: { mediaFile: true },
        },
      },
    });

    return { success: true, data: updatedSession };
  }

  async upsertFeedback(uuid: string, dto: UpsertFeedbackDto, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
      },
      include: {
        feedback: {
          include: {
            feedbackMediaFiles: {
              include: { mediaFile: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    // 현재 파일 수 계산
    const currentFileCount = session.feedback?.feedbackMediaFiles?.length ?? 0;
    const removeCount = dto.removeMediaFileUuids?.length ?? 0;
    const addNewCount = dto.addNewMediaFiles?.length ?? 0;
    const addExistingCount = dto.addExistingMediaFileUuids?.length ?? 0;
    const newTotalCount = currentFileCount - removeCount + addNewCount + addExistingCount;

    if (newTotalCount > MAX_MEDIA_FILES_PER_SESSION) {
      throw new BadRequestException(
        `피드백당 최대 ${MAX_MEDIA_FILES_PER_SESSION}개의 파일만 첨부할 수 있습니다.`,
      );
    }

    // 새 파일들의 용량 체크
    if (dto.addNewMediaFiles && dto.addNewMediaFiles.length > 0) {
      const totalSize = dto.addNewMediaFiles.reduce((sum, f) => sum + f.fileSize, 0);
      const canUpload = await this.storageQuotaService.canUpload(userId, totalSize);
      if (!canUpload) {
        throw new BadRequestException('스토리지 용량이 부족합니다.');
      }
    }

    // 기존 파일 재활용 시 소유권 확인
    let existingMediaFiles: { id: number }[] = [];
    if (dto.addExistingMediaFileUuids && dto.addExistingMediaFileUuids.length > 0) {
      existingMediaFiles = await this.prisma.mediaFile.findMany({
        where: {
          uuid: { in: dto.addExistingMediaFileUuids },
          userId,
        },
        select: { id: true },
      });

      if (existingMediaFiles.length !== dto.addExistingMediaFileUuids.length) {
        throw new BadRequestException('일부 파일을 찾을 수 없거나 권한이 없습니다.');
      }
    }

    // 삭제할 파일들 조회
    let filesToRemove: { id: number; mediaFile: { uuid: string } }[] = [];
    if (dto.removeMediaFileUuids && dto.removeMediaFileUuids.length > 0 && session.feedback) {
      filesToRemove = session.feedback.feedbackMediaFiles.filter((fmf) =>
        dto.removeMediaFileUuids!.includes(fmf.mediaFile.uuid),
      );
    }

    // 새 파일들 temp → 적절한 폴더로 이동 (contentType 기반)
    const movedFiles: { url: string; key: string; dto: CreateMediaFileDto }[] = [];
    if (dto.addNewMediaFiles) {
      for (const fileDto of dto.addNewMediaFiles) {
        const result = await this.s3Service.moveFileByContentType(fileDto.url, fileDto.contentType);
        if (!result) {
          throw new BadRequestException('파일 이동에 실패했습니다.');
        }
        movedFiles.push({ url: result.url, key: result.key, dto: fileDto });
      }
    }

    // 트랜잭션으로 DB 작업 수행
    const feedback = await this.prisma.$transaction(async (tx) => {
      let feedbackRecord;
      if (session.feedback) {
        feedbackRecord = await tx.feedback.update({
          where: { id: session.feedback.id },
          data: { notes: dto.notes },
        });
      }
      else {
        feedbackRecord = await tx.feedback.create({
          data: {
            notes: dto.notes,
            sessionId: session.id,
          },
        });
      }

      // 파일 연결 해제 (hard delete)
      for (const fmf of filesToRemove) {
        await tx.feedbackMediaFile.delete({
          where: { id: fmf.id },
        });
      }

      // 새 MediaFile 레코드 생성 및 연결
      for (const moved of movedFiles) {
        const mediaFile = await tx.mediaFile.create({
          data: {
            url: moved.url,
            publicId: moved.key,
            type: moved.dto.type,
            fileName: moved.dto.fileName,
            fileSize: moved.dto.fileSize,
            userId,
          },
        });

        await tx.feedbackMediaFile.create({
          data: {
            feedbackId: feedbackRecord.id,
            mediaFileId: mediaFile.id,
          },
        });
      }

      // 기존 파일 연결
      for (const existingFile of existingMediaFiles) {
        const existingLink = await tx.feedbackMediaFile.findFirst({
          where: {
            feedbackId: feedbackRecord.id,
            mediaFileId: existingFile.id,
          },
        });

        if (!existingLink) {
          await tx.feedbackMediaFile.create({
            data: {
              feedbackId: feedbackRecord.id,
              mediaFileId: existingFile.id,
            },
          });
        }
      }

      // 용량 증가
      if (movedFiles.length > 0) {
        const totalSize = movedFiles.reduce((sum, f) => sum + f.dto.fileSize, 0);
        await this.storageQuotaService.increaseUsage(userId, totalSize);
      }

      return feedbackRecord;
    });

    // 업데이트된 피드백 조회하여 반환
    const updatedFeedback = await this.prisma.feedback.findUnique({
      where: { id: feedback.id },
      include: {
        feedbackMediaFiles: {
          orderBy: { createdAt: 'asc' },
          include: { mediaFile: true },
        },
      },
    });

    return { success: true, data: updatedFeedback };
  }

  async deleteFeedback(uuid: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: {
        uuid,
        deletedAt: null,
        lesson: {
          deletedAt: null,
          student: { organization: { userId, deletedAt: null } },
        },
      },
      include: {
        feedback: {
          include: { feedbackMediaFiles: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session with UUID ${uuid} not found`);
    }

    if (!session.feedback) {
      throw new NotFoundException('Feedback not found');
    }

    // 트랜잭션으로 미디어 파일 연결 해제 및 피드백 삭제
    await this.prisma.$transaction(async (tx) => {
      // 미디어 파일 연결 해제
      if (session.feedback!.feedbackMediaFiles.length > 0) {
        await tx.feedbackMediaFile.deleteMany({
          where: { feedbackId: session.feedback!.id },
        });
      }

      // 피드백 soft delete
      await tx.feedback.update({
        where: { id: session.feedback!.id },
        data: { deletedAt: new Date() },
      });
    });

    return { success: true };
  }
}
