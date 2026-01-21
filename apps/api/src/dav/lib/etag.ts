import { createHash } from 'crypto';

export function generateEtag(id: number | string, updatedAt: Date): string {
  const data = `${id}-${updatedAt.getTime()}`;
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  return `"${hash}"`;
}

export function compareEtag(provided: string | null, current: string): boolean {
  if (!provided) return false;

  // Handle weak ETags (W/"...")
  const normalizedProvided = provided.replace(/^W\//, '').replace(/"/g, '');
  const normalizedCurrent = current.replace(/^W\//, '').replace(/"/g, '');

  return normalizedProvided === normalizedCurrent;
}

export function parseIfMatch(header: string | null): string[] {
  if (!header) return [];
  if (header === '*') return ['*'];

  return header.split(',').map(etag => etag.trim().replace(/"/g, ''));
}

export function parseIfNoneMatch(header: string | null): string[] {
  return parseIfMatch(header);
}
