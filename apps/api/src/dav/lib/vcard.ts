import type { Student } from '../../generated/prisma/client';

export function studentToVcard(student: Student): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `UID:${student.uuid}`,
    `FN:${escapeVcardText(student.name)}`,
    `N:;${escapeVcardText(student.name)};;;`,
  ];

  if (student.phone) {
    lines.push(`TEL;TYPE=CELL:${student.phone}`);
  }

  if (student.email) {
    lines.push(`EMAIL:${student.email}`);
  }

  if (student.notes) {
    lines.push(`NOTE:${escapeVcardText(student.notes)}`);
  }

  lines.push(`REV:${formatVcardDate(student.updatedAt)}`);
  lines.push('END:VCARD');

  return lines.join('\r\n');
}

export function parseVcard(vcard: string): {
  uid?: string;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
} {
  const result: {
    uid?: string;
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  } = {};

  const lines = unfoldLines(vcard);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const keyPart = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const key = keyPart.split(';')[0].toUpperCase();

    switch (key) {
      case 'UID':
        result.uid = value;
        break;
      case 'FN':
        result.name = unescapeVcardText(value);
        break;
      case 'TEL':
        result.phone = value;
        break;
      case 'EMAIL':
        result.email = value;
        break;
      case 'NOTE':
        result.notes = unescapeVcardText(value);
        break;
    }
  }

  return result;
}

function formatVcardDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeVcardText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function unescapeVcardText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function unfoldLines(vcard: string): string[] {
  // RFC 6350: Long lines are folded with CRLF + space/tab
  return vcard
    .replace(/\r\n[ \t]/g, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '');
}
