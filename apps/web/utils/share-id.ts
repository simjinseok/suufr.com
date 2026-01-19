import crypto from 'crypto';

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TOTAL_LENGTH = 10;

function toBase62(num: number): string {
  if (num === 0) return CHARSET[0];
  let result = '';
  while (num > 0) {
    result = CHARSET[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

function randomString(length: number): string {
  return Array.from(crypto.randomBytes(length))
    .map((b) => CHARSET[b % 62])
    .join('');
}

export function generateShareId(lessonId: number): string {
  const encoded = toBase62(lessonId);
  const randomLength = TOTAL_LENGTH - encoded.length;
  return `${encoded}${randomString(randomLength)}`;
}
