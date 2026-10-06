import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** OAuth 콜백(api 도메인) 결과를 web 으로 넘기는 일회용 인계 데이터 */
export type SocialHandoff = { sessionToken: string; userId: string };

const IDENTIFIER_PREFIX = 'social-handoff:';
const TTL_MS = 3 * 60 * 1000;

/**
 * 소셜 로그인은 Google → api 콜백 → api 도메인 쿠키 순으로 진행되는데, web 은 자체 쿠키(JWT·세션 토큰)를 쓴다.
 * api 는 결과를 verifications 에 3분짜리 일회용 코드로 저장하고 web 으로 리다이렉트하며,
 * web 서버가 그 코드를 교환해 토큰을 받는다. 코드는 해시로만 저장하고 한 번 쓰면 삭제된다.
 */
@Injectable()
export class SocialHandoffService {
  constructor(private readonly prisma: PrismaService) {}

  private identifierFor(code: string): string {
    return IDENTIFIER_PREFIX + createHash('sha256').update(code).digest('hex');
  }

  async create(payload: SocialHandoff): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: this.identifierFor(code),
        value: JSON.stringify(payload),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    return code;
  }

  /** 유효한 코드면 페이로드를 돌려주고 즉시 삭제한다. 만료·재사용·위조는 null */
  async consume(code: string): Promise<SocialHandoff | null> {
    if (!code || code.length > 128) return null;
    const identifier = this.identifierFor(code);
    const row = await this.prisma.verification.findFirst({ where: { identifier }, select: { id: true, value: true, expiresAt: true } });
    if (!row) return null;
    await this.prisma.verification.delete({ where: { id: row.id } });
    if (row.expiresAt.getTime() < Date.now()) return null;
    try {
      return JSON.parse(row.value) as SocialHandoff;
    }
    catch {
      return null;
    }
  }
}
