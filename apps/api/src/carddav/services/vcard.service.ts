import { Injectable } from '@nestjs/common';
import { fetchImageAsBase64, optimizeCloudinaryUrl } from '../utils/image.util';

export interface StudentContact {
  uuid: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string;
  status: string;
  updatedAt: Date;
  organization?: {
    name: string;
  };
  profileImageUrl?: string | null;
  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;
}

/**
 * Parsed vCard data for updates
 * - undefined: field not present in vCard (keep existing value)
 * - null: field present but empty (clear the value)
 * - string: field has a value (update to this value)
 */
export interface ParsedVcardUpdate {
  name?: string; // undefined = field not present, empty names are ignored
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  photoBase64?: string | null; // Base64 인코딩된 사진 데이터
  photoMediaType?: string; // 사진 MIME type (e.g., image/jpeg)
  birthYear?: number | null; // 연도 (null = 미상)
  birthMonth?: number | null; // 월 (1-12)
  birthDay?: number | null; // 일 (1-31)
}

// Base64 인코딩 시 ~33% 오버헤드 고려하여 500KB -> 700KB
const MAX_PHOTO_BASE64_SIZE = 700 * 1024;

// RFC 6350: 라인 길이는 998자를 초과할 수 없음 (unfolded 후)
// PHOTO 필드는 Base64 데이터로 길 수 있으므로 예외
const MAX_LINE_LENGTH = 10000; // PHOTO 등 긴 필드를 위해 넉넉하게 설정

@Injectable()
export class VcardService {
  /**
   * Convert a Student to vCard 3.0 format
   */
  async toVcard(student: StudentContact): Promise<string> {
    const lines: string[] = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `UID:${student.uuid}`,
      `FN:${this.escapeVcardValue(student.name)}`,
      `N:${this.escapeVcardValue(student.name)};;;;`,
    ];

    if (student.phone) {
      lines.push(`TEL;TYPE=CELL:${this.escapeVcardValue(student.phone)}`);
    }

    if (student.email) {
      lines.push(`EMAIL:${this.escapeVcardValue(student.email)}`);
    }

    if (student.organization?.name) {
      lines.push(`ORG:${this.escapeVcardValue(student.organization.name)}`);
    }

    if (student.notes) {
      lines.push(`NOTE:${this.escapeVcardValue(student.notes)}`);
    }

    // BDAY (생일)
    if (student.birthMonth && student.birthDay) {
      const mm = String(student.birthMonth).padStart(2, '0');
      const dd = String(student.birthDay).padStart(2, '0');
      if (student.birthYear) {
        // 전체 날짜: BDAY:1990-05-15
        lines.push(`BDAY:${student.birthYear}-${mm}-${dd}`);
      }
      else {
        // 연도 미상: BDAY:--05-15 (vCard 4.0 형식, 대부분 클라이언트 지원)
        lines.push(`BDAY:--${mm}-${dd}`);
      }
    }

    // PHOTO 속성 (base64 임베딩 - macOS 연락처 앱 호환성)
    if (student.profileImageUrl) {
      // Cloudinary URL인 경우 200x200으로 최적화하여 용량 절감
      const optimizedUrl = optimizeCloudinaryUrl(student.profileImageUrl, 200);
      const image = await fetchImageAsBase64(optimizedUrl);
      if (image) {
        // vCard 3.0: ENCODING=b, TYPE=JPEG/PNG
        const type = image.mediaType.split('/')[1]?.toUpperCase() || 'JPEG';
        lines.push(`PHOTO;ENCODING=b;TYPE=${type}:${image.base64}`);
      }
    }

    // Custom field for student status
    lines.push(`X-SUUFR-STATUS:${student.status}`);

    // Revision timestamp
    lines.push(`REV:${student.updatedAt.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);

    lines.push('END:VCARD');

    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Escape special characters in vCard values
   */
  private escapeVcardValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
      .replace(/\n/g, '\\n');
  }

  /**
   * Unfold vCard lines according to RFC 6350
   * Long lines are folded by inserting CRLF + whitespace
   * Continuation lines start with space or tab and should be concatenated
   */
  private unfoldLines(vcardData: string): string[] {
    const rawLines = vcardData.split(/\r?\n/);
    const unfolded: string[] = [];

    for (const line of rawLines) {
      // If line starts with space or tab, it's a continuation
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (unfolded.length > 0) {
          // Append to previous line (remove the leading whitespace)
          unfolded[unfolded.length - 1] += line.slice(1);
        }
      }
      else {
        unfolded.push(line);
      }
    }

    return unfolded;
  }

  /**
   * Parse vCard into a partial student update object
   * Only extracts fields that can be updated
   *
   * Returns:
   * - undefined for a field: field not present in vCard (keep existing value)
   * - null for a field: field present but empty (clear the value)
   * - string for a field: field has a value (update to this value)
   * - For name: empty names are ignored (treated as undefined) since name is required
   */
  parseVcard(vcardData: string): ParsedVcardUpdate | null {
    const lines = this.unfoldLines(vcardData);
    const result: ParsedVcardUpdate = {};
    let hasAnyField = false;

    for (const line of lines) {
      // 라인 길이 제한 (PHOTO 필드 제외한 일반 필드 보호)
      if (line.length > MAX_LINE_LENGTH && !line.toUpperCase().startsWith('PHOTO')) {
        continue; // 너무 긴 라인 무시
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const property = line.slice(0, colonIndex);
      const value = line.slice(colonIndex + 1);

      if (!property) continue;

      const propertyName = property.split(';')[0].toUpperCase();

      switch (propertyName) {
        case 'FN': {
          // For name: only set if non-empty (empty names are invalid)
          const unescaped = this.unescapeVcardValue(value).trim();
          if (unescaped) {
            result.name = unescaped;
            hasAnyField = true;
          }
          break;
        }
        case 'TEL': {
          hasAnyField = true;
          const unescaped = this.unescapeVcardValue(value).trim();
          result.phone = unescaped || null;
          break;
        }
        case 'EMAIL': {
          hasAnyField = true;
          const unescaped = this.unescapeVcardValue(value).trim();
          result.email = unescaped || null;
          break;
        }
        case 'NOTE': {
          hasAnyField = true;
          const unescaped = this.unescapeVcardValue(value).trim();
          result.notes = unescaped || null;
          break;
        }
        case 'PHOTO': {
          // 크기 제한 검증 (너무 큰 이미지는 무시)
          if (value && value.length > MAX_PHOTO_BASE64_SIZE) {
            break;
          }

          // Base64 유효성 검증
          if (value) {
            try {
              Buffer.from(value, 'base64');
            }
            catch {
              break; // 유효하지 않은 Base64는 무시
            }
          }

          // Base64 인코딩된 사진만 처리 (클라이언트에서 보낸 데이터)
          // URL 참조 방식은 무시 (서버에서 보낸 것)
          const upperProperty = property.toUpperCase();
          if (upperProperty.includes('ENCODING=B') || upperProperty.includes('ENCODING=BASE64')) {
            hasAnyField = true;
            result.photoBase64 = value || null;

            // TYPE 파라미터에서 미디어 타입 추출
            const typeMatch = upperProperty.match(/TYPE=([^;:]+)/i);
            if (typeMatch) {
              const type = typeMatch[1].toLowerCase();
              result.photoMediaType = `image/${type}`;
            }
            else {
              result.photoMediaType = 'image/jpeg'; // 기본값
            }
          }
          else if (!upperProperty.includes('VALUE=URI')) {
            // VALUE=URI가 아니고 ENCODING도 없으면 base64로 간주 (일부 클라이언트)
            hasAnyField = true;
            result.photoBase64 = value || null;
            result.photoMediaType = 'image/jpeg';
          }
          break;
        }
        case 'BDAY': {
          // BDAY 형식:
          // - 전체 날짜: 1990-05-15 또는 19900515
          // - 연도 미상: --05-15 또는 --0515
          hasAnyField = true;
          const trimmed = value.trim();

          if (!trimmed) {
            // 빈 값 = 생일 삭제
            result.birthYear = null;
            result.birthMonth = null;
            result.birthDay = null;
            break;
          }

          // --MM-DD 또는 --MMDD (연도 미상)
          const noYearMatch = trimmed.match(/^--(\d{2})-?(\d{2})$/);
          if (noYearMatch) {
            result.birthYear = null;
            result.birthMonth = parseInt(noYearMatch[1], 10);
            result.birthDay = parseInt(noYearMatch[2], 10);
            break;
          }

          // YYYY-MM-DD 또는 YYYYMMDD (전체 날짜)
          const fullMatch = trimmed.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
          if (fullMatch) {
            result.birthYear = parseInt(fullMatch[1], 10);
            result.birthMonth = parseInt(fullMatch[2], 10);
            result.birthDay = parseInt(fullMatch[3], 10);
          }
          break;
        }
      }
    }

    return hasAnyField ? result : null;
  }

  /**
   * Unescape vCard values
   */
  private unescapeVcardValue(value: string): string {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\;/g, ';')
      .replace(/\\,/g, ',')
      .replace(/\\\\/g, '\\');
  }
}
