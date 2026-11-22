import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** 양성 결과(사용자 있음)를 믿는 시간. 탈퇴는 invalidate 로 즉시 끊는다 */
export const USER_EXISTENCE_TTL_MS = 60_000;
/** 캐시가 무한히 커지지 않게 하는 상한. 넘으면 가장 오래 확인한 항목부터 버린다 */
const MAX_ENTRIES = 10_000;

/**
 * JWT 의 sub 가 아직 users 에 있는지 확인한다 (JwtAuthGuard 가 호출).
 * JWT(1시간)는 로컬 검증만 하므로, 이 확인이 없으면 탈퇴한 사용자의 남은 JWT 로 요청이 통과해
 * /auth/me 의 getOrCreateUserSettings 같은 경로가 고아 행을 다시 만든다.
 * - 있음만 USER_EXISTENCE_TTL_MS 동안 프로세스에 캐시한다. 없음은 캐시하지 않는다(매번 PK 조회).
 * - 탈퇴(AccountDeletionService)가 invalidate 를 불러 이 프로세스의 캐시를 즉시 지운다.
 *   api 를 여러 프로세스로 띄우면 다른 프로세스는 최대 TTL 동안 통과시킬 수 있다(현재 운영은 단일 프로세스).
 */
@Injectable()
export class UserExistenceService {
  /** userId → 마지막으로 있음을 확인한 시각. Map 삽입 순서 = 확인 순서 */
  private readonly confirmedAt = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async exists(userId: string): Promise<boolean> {
    const at = this.confirmedAt.get(userId);
    if (at !== undefined && Date.now() - at < USER_EXISTENCE_TTL_MS) {
      return true;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    this.confirmedAt.delete(userId);
    if (!user) {
      return false;
    }
    this.confirmedAt.set(userId, Date.now());
    if (this.confirmedAt.size > MAX_ENTRIES) {
      const oldest = this.confirmedAt.keys().next().value;
      if (oldest !== undefined) this.confirmedAt.delete(oldest);
    }
    return true;
  }

  invalidate(userId: string): void {
    this.confirmedAt.delete(userId);
  }
}
