import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';

const USER = '11111111-1111-4111-8111-111111111111';

function build(pages: Array<{ keys: string[]; next?: string }>, deleteErrors: unknown[] = []) {
  const service = new S3Service();
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof ListObjectsV2Command) {
      const token = command.input.ContinuationToken;
      const index = token ? Number(token) : 0;
      const page = pages[index]!;
      return { Contents: page.keys.map(Key => ({ Key })), IsTruncated: Boolean(page.next), NextContinuationToken: page.next };
    }
    if (command instanceof DeleteObjectsCommand) return { Errors: deleteErrors };
    throw new Error('unexpected command');
  });
  (service as unknown as { s3Client: { send: typeof send } }).s3Client = { send };
  return { service, send };
}

describe('S3Service.deleteByPrefix', () => {
  it('사용자 단위 prefix 가 아니면 S3 를 부르지 않고 거부한다', async () => {
    const { service, send } = build([{ keys: [] }]);
    for (const prefix of ['', 'users/', 'users', 'images/profiles/', `users/${USER}`, `other/${USER}/`, `users/${USER}/images/`]) {
      await expect(service.deleteByPrefix(prefix), prefix).rejects.toThrow('Refusing');
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('페이지를 끝까지 읽어 페이지마다 DeleteObjects 로 지운다', async () => {
    const { service, send } = build([{ keys: ['a', 'b'], next: '1' }, { keys: ['c'] }]);
    await expect(service.deleteByPrefix(`users/${USER}/`)).resolves.toBe(3);
    const deletes = send.mock.calls.map(c => c[0]).filter((c): c is DeleteObjectsCommand => c instanceof DeleteObjectsCommand);
    expect(deletes.map(c => c.input.Delete?.Objects?.map(o => o.Key))).toEqual([['a', 'b'], ['c']]);
  });

  it('일부 키라도 실패하면 던진다 (재시도 대상)', async () => {
    const { service } = build([{ keys: ['a'] }], [{ Key: 'a', Code: 'AccessDenied' }]);
    await expect(service.deleteByPrefix(`images/profiles/${USER}/`)).rejects.toThrow('AccessDenied');
  });
});
