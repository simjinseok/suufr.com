import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DavSession } from '../app-tokens/app-tokens.service';
import { VcardService, StudentContact, ParsedVcardUpdate } from './services/vcard.service';
import { XmlBuilderService } from './services/xml-builder.service';
import { S3Service } from '../s3/s3.service';
import { generateEtag, generateCtag } from './utils/etag.util';
import { pLimit } from './utils/image.util';

// 동시 이미지 fetch 제한 (5개)
const IMAGE_FETCH_CONCURRENCY = 5;

// Sync token format: data:,{timestamp}
// We use this simple format that encodes the timestamp
function generateSyncToken(date: Date | null): string {
  const timestamp = date ? date.getTime() : 0;
  return `data:,${timestamp}`;
}

function parseSyncToken(token: string): Date | null {
  if (!token || !token.startsWith('data:,')) {
    return null;
  }
  const timestamp = parseInt(token.slice(6), 10);
  if (isNaN(timestamp) || timestamp === 0) {
    return null;
  }
  return new Date(timestamp);
}

@Injectable()
export class CarddavService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vcardService: VcardService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Get all students for a user as contacts
   */
  async getStudents(userId: string): Promise<StudentContact[]> {
    const students = await this.prisma.student.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return students.map(s => ({
      uuid: s.uuid,
      name: s.name,
      phone: s.phone,
      email: s.email,
      notes: s.notes,
      status: s.status,
      updatedAt: s.updatedAt,
      organization: s.organization,
      profileImageUrl: s.profileImageUrl,
      birthYear: s.birthYear,
      birthMonth: s.birthMonth,
      birthDay: s.birthDay,
    }));
  }

  /**
   * Get a single student by UUID
   */
  async getStudent(uuid: string, userId: string): Promise<StudentContact | null> {
    const student = await this.prisma.student.findFirst({
      where: {
        uuid,
        userId,
        deletedAt: null,
      },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!student) {
      return null;
    }

    return {
      uuid: student.uuid,
      name: student.name,
      phone: student.phone,
      email: student.email,
      notes: student.notes,
      status: student.status,
      updatedAt: student.updatedAt,
      organization: student.organization,
      profileImageUrl: student.profileImageUrl,
      birthYear: student.birthYear,
      birthMonth: student.birthMonth,
      birthDay: student.birthDay,
    };
  }

  /**
   * Get the latest updatedAt for CTag generation
   */
  async getLatestUpdatedAt(userId: string): Promise<Date | null> {
    const latest = await this.prisma.student.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return latest?.updatedAt ?? null;
  }

  /**
   * Build PROPFIND response for root/discovery
   */
  buildRootPropfindResponse(session: DavSession): string {
    const userId = session.user.id;

    return this.xmlBuilderService.buildMultistatus([
      {
        href: '/carddav/',
        status: 200,
        properties: [
          { name: 'resourcetype', children: [{ name: 'collection' }] },
          {
            name: 'current-user-principal',
            children: [
              { name: 'href', value: `/carddav/principals/${userId}/` },
            ],
          },
        ],
      },
    ]);
  }

  /**
   * Build PROPFIND response for principal
   */
  async buildPrincipalPropfindResponse(session: DavSession, depth: string): Promise<string> {
    const userId = session.user.id;
    const displayName = session.organization.name;

    const responses = [
      {
        href: `/carddav/principals/${userId}/`,
        status: 200,
        properties: this.xmlBuilderService.buildPrincipalProps(userId, displayName),
      },
    ];

    // If depth is 1, include the contacts collection
    if (depth === '1') {
      const latestUpdatedAt = await this.getLatestUpdatedAt(userId);
      const ctag = generateCtag(latestUpdatedAt);
      const syncToken = generateSyncToken(latestUpdatedAt);
      responses.push({
        href: `/carddav/principals/${userId}/contacts/`,
        status: 200,
        properties: this.xmlBuilderService.buildAddressBookProps(userId, `${displayName} 학생`, ctag, syncToken),
      });
    }

    return this.xmlBuilderService.buildMultistatus(responses);
  }

  /**
   * Build PROPFIND response for address book (depth 0)
   */
  async buildAddressBookPropfindResponse(session: DavSession, depth: string): Promise<string> {
    const userId = session.user.id;
    const displayName = `${session.organization.name} 학생`;
    const latestUpdatedAt = await this.getLatestUpdatedAt(userId);
    const ctag = generateCtag(latestUpdatedAt);
    const syncToken = generateSyncToken(latestUpdatedAt);

    const responses = [
      {
        href: `/carddav/principals/${userId}/contacts/`,
        status: 200,
        properties: this.xmlBuilderService.buildAddressBookProps(userId, displayName, ctag, syncToken),
      },
    ];

    // If depth is 1, include all contacts
    if (depth === '1') {
      const students = await this.getStudents(userId);

      for (const student of students) {
        const etag = generateEtag(student.uuid, student.updatedAt);
        responses.push({
          href: `/carddav/principals/${userId}/contacts/${student.uuid}.vcf`,
          status: 200,
          properties: this.xmlBuilderService.buildContactProps(
            `/carddav/principals/${userId}/contacts/${student.uuid}.vcf`,
            etag,
          ),
        });
      }
    }

    return this.xmlBuilderService.buildMultistatus(responses);
  }

  /**
   * Get vCard for a single contact
   */
  async getContactVcard(uuid: string, session: DavSession): Promise<{ vcard: string; etag: string } | null> {
    const student = await this.getStudent(uuid, session.user.id);

    if (!student) {
      return null;
    }

    const vcard = await this.vcardService.toVcard(student);
    const etag = generateEtag(student.uuid, student.updatedAt);

    return { vcard, etag };
  }

  /**
   * Handle addressbook-multiget REPORT request
   * Optimized: single query + parallel vCard generation
   */
  async handleMultiget(session: DavSession, uuids: string[]): Promise<string> {
    // 1. 한 번의 쿼리로 모든 학생 조회 (N+1 제거)
    const students = await this.prisma.student.findMany({
      where: {
        uuid: { in: uuids },
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    // 2. 동시성 제한을 적용하여 vCard 생성 (이미지 fetch 포함)
    const limit = pLimit(IMAGE_FETCH_CONCURRENCY);

    const contacts = await Promise.all(
      students.map((student) =>
        limit(async () => {
          const contact: StudentContact = {
            uuid: student.uuid,
            name: student.name,
            phone: student.phone,
            email: student.email,
            notes: student.notes,
            status: student.status,
            updatedAt: student.updatedAt,
            organization: student.organization,
            profileImageUrl: student.profileImageUrl,
            birthYear: student.birthYear,
            birthMonth: student.birthMonth,
            birthDay: student.birthDay,
          };
          const etag = generateEtag(student.uuid, student.updatedAt);
          const vcardData = await this.vcardService.toVcard(contact);
          return {
            href: `/carddav/principals/${session.user.id}/contacts/${student.uuid}.vcf`,
            etag,
            vcardData,
          };
        }),
      ),
    );

    return this.xmlBuilderService.buildMultigetResponse(contacts);
  }

  /**
   * Handle sync-collection REPORT request
   * Returns changes since the given sync token
   */
  async handleSyncCollection(session: DavSession, syncToken: string | null): Promise<string> {
    const userId = session.user.id;
    const sinceDate = syncToken ? parseSyncToken(syncToken) : null;

    // Get changed/new students since the token
    const changedStudents = await this.prisma.student.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(sinceDate && { updatedAt: { gt: sinceDate } }),
      },
      select: {
        uuid: true,
        updatedAt: true,
      },
    });

    // Get deleted students since the token (only if we have a token - first sync doesn't need deletions)
    const deletedStudents = sinceDate
      ? await this.prisma.student.findMany({
          where: {
            userId,
            deletedAt: { gt: sinceDate },
          },
          select: {
            uuid: true,
          },
        })
      : [];

    const changed = changedStudents.map(s => ({
      href: `/carddav/principals/${userId}/contacts/${s.uuid}.vcf`,
      etag: generateEtag(s.uuid, s.updatedAt),
    }));

    const deleted = deletedStudents.map(s =>
      `/carddav/principals/${userId}/contacts/${s.uuid}.vcf`,
    );

    // Generate new sync token based on current time
    const newSyncToken = generateSyncToken(new Date());

    return this.xmlBuilderService.buildSyncCollectionResponse(changed, deleted, newSyncToken);
  }

  /**
   * Parse vCard data (delegate to VcardService)
   */
  parseVcard(vcardData: string): ParsedVcardUpdate | null {
    return this.vcardService.parseVcard(vcardData);
  }

  /**
   * Update a student from vCard data
   * @param uuid - Student UUID
   * @param userId - User ID for ownership verification
   * @param updates - Parsed vCard update data
   * @param expectedEtag - Optional ETag for optimistic concurrency control
   */
  async updateStudentFromVcard(
    uuid: string,
    userId: string,
    updates: ParsedVcardUpdate,
    expectedEtag?: string,
  ): Promise<
    | { student: StudentContact; etag: string }
    | { error: 'not_found' | 'etag_mismatch' | 'forbidden' }
  > {
    // 1. Find the student
    const student = await this.prisma.student.findFirst({
      where: {
        uuid,
        deletedAt: null,
      },
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    if (!student) {
      return { error: 'not_found' };
    }

    // 2. Verify ownership
    if (student.userId !== userId) {
      return { error: 'forbidden' };
    }

    // 3. ETag verification (if provided)
    if (expectedEtag) {
      const currentEtag = generateEtag(student.uuid, student.updatedAt);
      if (currentEtag !== expectedEtag) {
        return { error: 'etag_mismatch' };
      }
    }

    // 4. Build update data (only include fields that are present in updates)
    const updateData: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      notes?: string;
      profileImageUrl?: string | null;
      birthYear?: number | null;
      birthMonth?: number | null;
      birthDay?: number | null;
    } = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.phone !== undefined) {
      updateData.phone = updates.phone;
    }
    if (updates.email !== undefined) {
      updateData.email = updates.email;
    }
    if (updates.notes !== undefined) {
      // notes field in DB is non-nullable, so convert null to empty string
      updateData.notes = updates.notes ?? '';
    }
    // 생일 업데이트 (하나라도 설정되어 있으면 전체 업데이트)
    if (updates.birthYear !== undefined || updates.birthMonth !== undefined || updates.birthDay !== undefined) {
      updateData.birthYear = updates.birthYear ?? null;
      updateData.birthMonth = updates.birthMonth ?? null;
      updateData.birthDay = updates.birthDay ?? null;
    }

     // 5. Handle photo update (S3 실패 시 다른 필드는 계속 업데이트)
     if (updates.photoBase64 !== undefined) {
       try {
         // 기존 사진이 있으면 삭제
         if (student.profileImageUrl) {
           await this.s3Service.deleteByUrl(student.profileImageUrl);
         }

         if (updates.photoBase64) {
           // 새 사진 업로드
           const mediaType = updates.photoMediaType ?? 'image/jpeg';
           const newPhotoUrl = await this.s3Service.uploadPhoto(updates.photoBase64, mediaType);
           updateData.profileImageUrl = newPhotoUrl;
         }
         else {
           // 사진 삭제 (null로 설정)
           updateData.profileImageUrl = null;
         }
       }
       catch (error) {
         // 사진 업로드 실패 시 로깅하고 다른 필드는 계속 업데이트
         console.error('Photo upload failed:', error);
         // profileImageUrl은 업데이트하지 않음 (기존 값 유지)
       }
     }

    // 6. Update student
    const updatedStudent = await this.prisma.student.update({
      where: { id: student.id },
      data: updateData,
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    // 7. Return result with new ETag
    const result: StudentContact = {
      uuid: updatedStudent.uuid,
      name: updatedStudent.name,
      phone: updatedStudent.phone,
      email: updatedStudent.email,
      notes: updatedStudent.notes,
      status: updatedStudent.status,
      updatedAt: updatedStudent.updatedAt,
      organization: updatedStudent.organization,
      profileImageUrl: updatedStudent.profileImageUrl,
      birthYear: updatedStudent.birthYear,
      birthMonth: updatedStudent.birthMonth,
      birthDay: updatedStudent.birthDay,
    };

    return {
      student: result,
      etag: generateEtag(result.uuid, result.updatedAt),
    };
  }
}
