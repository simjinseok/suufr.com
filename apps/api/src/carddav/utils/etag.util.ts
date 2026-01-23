import { createHash } from 'crypto';

/**
 * Generate ETag for a single contact
 */
export function generateEtag(uuid: string, updatedAt: Date): string {
  const hash = createHash('md5')
    .update(`${uuid}:${updatedAt.toISOString()}`)
    .digest('hex');
  return `"${hash}"`;
}

/**
 * Generate CTag (collection tag) for the address book
 * Uses the most recent updatedAt timestamp from all contacts
 * Note: CTag doesn't need quotes (unlike ETag in HTTP headers)
 */
export function generateCtag(latestUpdatedAt: Date | null): string {
  if (!latestUpdatedAt) {
    return 'empty';
  }
  const hash = createHash('md5')
    .update(latestUpdatedAt.toISOString())
    .digest('hex');
  return hash;
}
