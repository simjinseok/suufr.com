import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ConsentTypeValue } from '@prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from '../common/constants/legal';

export type ConsentInput = {
  terms: boolean;
  privacy: boolean;
  overseasTransfer: boolean;
  termsVersion: string;
  privacyVersion: string;
};

export type ConsentMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

// 동의 종류별 최신 동의 버전. null = 동의 이력 없음(또는 마지막 행이 철회).
export type ConsentStatus = {
  terms: string | null;
  privacy: string | null;
  overseasTransfer: string | null;
  // 하나라도 현재 문서 버전에 동의하지 않았으면 true → 재동의 모달
  required: boolean;
};

// 국외 이전 동의는 개인정보처리방침에 귀속된다 (별도 문서 없음)
const REQUIRED_VERSIONS: Record<ConsentTypeValue, string> = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_POLICY_VERSION,
  overseas_transfer: PRIVACY_POLICY_VERSION,
};

const MAX_UA_LENGTH = 512;
const MAX_IP_LENGTH = 45;

@Injectable()
export class ConsentsService {
  private readonly logger = new Logger(ConsentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 동의 3종을 한 번에 기록한다 (추가 전용).
   * web이 보낸 문서 버전을 그대로 남긴다 — 이용자가 실제로 본 문서가 그 버전이다.
   * 상수와 다르면 getStatus().required 가 true 가 되어 재동의로 수렴한다.
   */
  async record(userId: string, input: ConsentInput, meta: ConsentMeta = {}) {
    const ipAddress = meta.ipAddress?.slice(0, MAX_IP_LENGTH) ?? null;
    const userAgent = meta.userAgent?.slice(0, MAX_UA_LENGTH) ?? null;

    await this.prisma.userConsent.createMany({
      data: [
        { userId, type: ConsentTypeValue.terms, docVersion: input.termsVersion, agreed: input.terms, ipAddress, userAgent },
        { userId, type: ConsentTypeValue.privacy, docVersion: input.privacyVersion, agreed: input.privacy, ipAddress, userAgent },
        { userId, type: ConsentTypeValue.overseas_transfer, docVersion: input.privacyVersion, agreed: input.overseasTransfer, ipAddress, userAgent },
      ],
    });
  }

  /**
   * record()와 같지만 실패를 호출자에게 전파하지 않는다.
   * 가입 흐름에서 사용: Cognito 사용자가 이미 생성된 뒤라 실패해도 가입을 되돌릴 수 없고,
   * 실패 시에도 첫 로그인의 재동의 모달(getStatus().required)이 이력을 보완한다.
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

    const status = {
      terms: versionOf(ConsentTypeValue.terms),
      privacy: versionOf(ConsentTypeValue.privacy),
      overseasTransfer: versionOf(ConsentTypeValue.overseas_transfer),
    };

    const required
      = status.terms !== REQUIRED_VERSIONS.terms
        || status.privacy !== REQUIRED_VERSIONS.privacy
        || status.overseasTransfer !== REQUIRED_VERSIONS.overseas_transfer;

    return { ...status, required };
  }
}
