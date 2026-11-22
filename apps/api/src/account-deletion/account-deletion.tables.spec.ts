import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/generated/client';
import { AccountDeletionService } from './account-deletion.service';
import {
  CASCADE_MODELS,
  DELETED_MODELS,
  RETAINED_MODELS,
  UNRELATED_MODELS,
  delegateName,
} from './account-deletion.tables';

type RuntimeField = { name: string; kind: string; type: string; relationName?: string };
type RuntimeModel = { dbName: string | null; fields: RuntimeField[] };

/**
 * 생성된 클라이언트의 런타임 데이터 모델 (generate 가 DMMF 에서 만든 모델·필드·관계 목록).
 * Prisma 7 은 Prisma.dmmf 를 내보내지 않으므로 클라이언트 인스턴스가 들고 있는 이 값을 쓴다. 연결은 하지 않는다.
 */
function runtimeModels(): Record<string, RuntimeModel> {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: 'postgresql://unused.invalid/none' }) });
  return (client as unknown as { _runtimeDataModel: { models: Record<string, RuntimeModel> } })._runtimeDataModel.models;
}

const models = runtimeModels();
const modelNames = Object.keys(models);
const classified: Record<string, readonly string[]> = {
  DELETED_MODELS,
  CASCADE_MODELS,
  RETAINED_MODELS,
  UNRELATED_MODELS,
};

describe('계정 삭제 테이블 분류 (스키마의 모든 모델)', () => {
  it('런타임 데이터 모델과 Prisma.ModelName 이 같은 모델 목록이다 (분류 기준이 실제 스키마)', () => {
    expect(modelNames.sort()).toEqual(Object.keys(Prisma.ModelName).sort());
  });

  it('모든 모델이 정확히 한 목록(삭제/Cascade/보존/무관)에 있다 — 모델을 추가하면 여기서 실패한다', () => {
    const unclassified = modelNames.filter(name => !Object.values(classified).some(list => list.includes(name)));
    expect(unclassified, '분류되지 않은 모델: account-deletion.tables.ts 에 추가하고 deleteUserRows 를 고친다').toEqual([]);

    const duplicated = modelNames.filter(name => Object.values(classified).filter(list => list.includes(name)).length > 1);
    expect(duplicated).toEqual([]);

    const unknown = Object.values(classified).flat().filter(name => !modelNames.includes(name));
    expect(unknown).toEqual([]);
  });

  it('userId 컬럼이 있는 모델은 "무관"일 수 없다', () => {
    const userOwnedButUnrelated = (UNRELATED_MODELS as readonly string[]).filter(name => models[name]!.fields.some(f => f.name === 'userId'));
    expect(userOwnedButUnrelated).toEqual([]);
  });

  it('삭제 모델은 userId 를 갖거나, 삭제 목록의 다른 모델과 관계로 이어진다 (범위를 잡을 수 있다)', () => {
    // Verification 은 사용자 컬럼이 없다 — 식별자(이메일·userId)와 값(userId)으로 찾는다
    const identifierScoped = ['Verification', 'User'];
    const unreachable = DELETED_MODELS.filter((name) => {
      if (identifierScoped.includes(name)) return false;
      const fields = models[name]!.fields;
      return !fields.some(f => f.name === 'userId')
        && !fields.some(f => f.kind === 'object' && (DELETED_MODELS as readonly string[]).includes(f.type));
    });
    expect(unreachable).toEqual([]);
  });

  it('Cascade 모델은 users 관계에 onDelete: Cascade 가 걸려 있다 (schema.prisma)', () => {
    const schema = readFileSync(path.resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
    for (const name of CASCADE_MODELS) {
      const block = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
      expect(block, `${name} 의 User 관계`).toMatch(/\bUser\s+@relation\([^)]*onDelete:\s*Cascade[^)]*\)/);
      expect(models[name]!.fields.some(f => f.kind === 'object' && f.type === 'User')).toBe(true);
    }
  });
});

describe('AccountDeletionService.deleteUserRows', () => {
  const USER = '11111111-1111-4111-8111-111111111111';

  /** delegate.method 호출을 모두 기록하는 tx */
  function recordingTx() {
    const calls: Array<{ delegate: string; method: string; args: unknown }> = [];
    const tx = new Proxy({}, {
      get: (_target, delegate: string) => new Proxy({}, {
        get: (_t, method: string) => async (args: unknown) => {
          calls.push({ delegate, method, args });
          return { count: 0 };
        },
      }),
    });
    return { tx: tx as Prisma.TransactionClient, calls };
  }

  async function run(legacyKeys?: string[]) {
    const { tx, calls } = recordingTx();
    const service = Object.create(AccountDeletionService.prototype) as AccountDeletionService;
    await service.deleteUserRows(tx, USER, 'Teacher@Example.com', legacyKeys);
    return calls;
  }

  it('삭제 목록의 모델만, 빠짐없이 지운다. 보존·Cascade·무관 모델은 지우지 않는다', async () => {
    const calls = await run();
    const deleted = new Set(calls.filter(c => c.method === 'deleteMany' || c.method === 'delete').map(c => c.delegate));
    expect([...deleted].sort()).toEqual(DELETED_MODELS.map(delegateName).sort());
    for (const name of [...CASCADE_MODELS, ...RETAINED_MODELS, ...UNRELATED_MODELS]) {
      expect(deleted.has(delegateName(name)), name).toBe(false);
    }
  });

  it('users 는 마지막에 지우고, 그 뒤 탈퇴 기록의 삭제 시각과 legacy S3 키만 갱신한다', async () => {
    const calls = await run(['photos/a.jpg']);
    const userIndex = calls.findIndex(c => c.delegate === 'user');
    expect(calls[userIndex]).toMatchObject({ method: 'delete', args: { where: { id: USER } } });
    expect(calls.slice(userIndex + 1)).toEqual([
      { delegate: 'accountDeletion', method: 'update', args: { where: { userId: USER }, data: { deletedAt: expect.any(Date), pendingStorageKeys: ['photos/a.jpg'] } } },
    ]);
  });

  it('자식 → 부모 순서로 지운다 (onDelete 없는 FK)', async () => {
    const order = (await run()).map(c => c.delegate);
    const before = (child: string, parent: string) => expect(order.indexOf(child), `${child} < ${parent}`).toBeLessThan(order.indexOf(parent));
    before('sessionMediaFile', 'session');
    before('sessionMediaFile', 'mediaFile');
    before('curriculumItemMediaFile', 'curriculumItem');
    before('curriculumItemMediaFile', 'mediaFile');
    before('invoicePayment', 'invoice');
    before('invoicePayment', 'payment');
    before('sessionGoogleEvent', 'session');
    before('feedback', 'session');
    before('session', 'invoice');
    before('session', 'lesson');
    before('invoice', 'lesson');
    before('lessonShare', 'lesson');
    before('lesson', 'student');
    before('payment', 'student');
    before('studentShare', 'student');
    before('studentComment', 'student');
    before('studentStatus', 'student');
    before('studentGoogleContact', 'student');
    before('student', 'organization');
    before('meeting', 'organization');
    before('curriculumItem', 'curriculumSection');
    before('curriculumSection', 'curriculum');
    before('curriculum', 'organization');
  });

  it('소프트 삭제된 행도 지운다 (deletedAt 조건 없음)', async () => {
    const calls = await run();
    const wheres = calls.filter(c => c.method !== 'update').map(c => (c.args as { where: unknown }).where);
    expect(JSON.stringify(wheres)).not.toContain('deletedAt');
  });

  it('verifications 는 그 이메일의 OTP 식별자·탈퇴 OTP·값이 userId 인 행만 지운다', async () => {
    const calls = await run();
    const verification = calls.find(c => c.delegate === 'verification');
    expect(verification?.args).toEqual({
      where: {
        OR: [
          {
            identifier: {
              in: [
                'email-verification-otp-teacher@example.com',
                'sign-in-otp-teacher@example.com',
                'forget-password-otp-teacher@example.com',
                'change-email-otp-teacher@example.com',
                `delete-account-otp:${USER}`,
              ],
            },
          },
          { value: USER },
        ],
      },
    });
  });
});
