import { randomBytes, createHash } from 'crypto';

const TOKEN_PREFIX = 'st_';
const TOKEN_BYTES = 32;

export function generateAppToken(): string {
  const bytes = randomBytes(TOKEN_BYTES);
  const token = bytes.toString('base64url');
  return `${TOKEN_PREFIX}${token}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function verifyToken(token: string, hash: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  return tokenHash === hash;
}
