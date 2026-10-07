import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ConsentTypeValue } from '@prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';

export type ConsentInput = {
  terms: boolean;
  privacy: boolean;
  termsVersion: string;
  privacyVersion: string;
};

export type ConsentMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

// 동의 종류별 최신 동의 버전. null = 동의 이력 없음(또는 마지막 행이 철회).
// 현재 문서 버전과 달라도 재동의를 요구하지 않는다 — 약관·방침 개정은 제3조대로 사전 공지(이메일)로 고지하고 이력은 기록용이다.
export type ConsentStatus = {
  terms: string | null;
  privacy: string | null;
};

// 국외 처리(AWS 도쿄 리전 등)는 개인정보처리방침에 공개하는 것으로 갈음한다 — 별도 동의 종류를 두지 않는다.
// overseas_transfer 는 과거 이력 행에만 남아 있고 더 기록하지 않는다.

const MAX_UA_LENGTH = 512;
const MAX_IP_LENGTH = 45;

@Injectable()
export class ConsentsService {
  private readonly logger = new Logger(ConsentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 동의 2종(이용약관·개인정보처리방침)을 한 번에 기록한다 (추가 전용).
   * 클라이언트가 보낸 문서 버전을 그대로 남긴다 — 이용자가 실제로 본 문서가 그 버전이다.
   */
  async record(userId: string, input: ConsentInput, meta: ConsentMeta = {}) {
    const ipAddress = meta.ipAddress?.slice(0, MAX_IP_LENGTH) ?? null;
    const userAgent = meta.userAgent?.slice(0, MAX_UA_LENGTH) ?? null;

    await this.prisma.userConsent.createMany({
      data: [
        { userId, type: ConsentTypeValue.terms, docVersion: input.termsVersion, agreed: input.terms, ipAddress, userAgent },
        { userId, type: ConsentTypeValue.privacy, docVersion: input.privacyVersion, agreed: input.privacy, ipAddress, userAgent },
      ],
    });
  }

  /**
   * record()와 같지만 실패를 호출자에게 전파하지 않는다.
   * 가입 흐름에서 사용: 사용자가 이미 생성된 뒤라 실패해도 가입을 되돌릴 수 없다.
   */
  async recordSafely(userId: string, input: ConsentInput, meta: ConsentMeta = {}) {
    try {
      await this.record(userId, input, meta);
    }
    catch (error) {
      this.logger.error(`동의 이력 기록 실패 (userId=${userId})`, error instanceof Error ? error.stack : String(error));
      Sentry.captureException(error, { extra: { userId, stage: 'signup-consent' } });
    }
  }

  /**
   * 동의 이력이 전혀 없을 때만 기록한다. iOS 네이티브 Google 로그인이 매번 동의값을 보내도 신규 가입 1회만 남기기 위함.
   * 기록 여부를 돌려준다.
   */
  async recordIfAbsent(userId: string, input: ConsentInput, meta: ConsentMeta = {}): Promise<boolean> {
    const count = await this.prisma.userConsent.count({ where: { userId } });
    if (count > 0) return false;
    await this.record(userId, input, meta);
    return true;
  }

  async getStatus(userId: string): Promise<ConsentStatus> {
    // 타입별 최신 1행만 필요. 행 수가 적으므로 최신순으로 읽어 메모리에서 첫 등장만 취한다.
    const rows = await this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: [{ consentedAt: 'desc' }, { id: 'desc' }],
      select: { type: true, docVersion: true, agreed: true },
    });

    const latest = new Map<ConsentTypeValue, { docVersion: string; agreed: boolean }>();
    for (const row of rows) {
      if (!latest.has(row.type)) latest.set(row.type, row);
    }

    const versionOf = (type: ConsentTypeValue) => {
      const row = latest.get(type);
      return row && row.agreed ? row.docVersion : null;
    };

    return {
      terms: versionOf(ConsentTypeValue.terms),
      privacy: versionOf(ConsentTypeValue.privacy),
    };
  }
}
