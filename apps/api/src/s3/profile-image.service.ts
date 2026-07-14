import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { S3Service } from './s3.service';
import {
  SUPPORTED_PROFILE_IMAGE_TYPES,
  MAX_PROFILE_IMAGE_SIZE,
} from '../common/constants/file-constraints';

export interface ProfileImageChange {
  /** DB에 쓸 값. undefined = 필드 미변경 (update data에서 제외할 것) */
  url: string | null | undefined;
  /** 저장 성공 후 삭제할 이전 객체 URL (scheduleDeletion에 넘길 것) */
  previousUrlToDelete: string | null;
}

/**
 * 프로필성 이미지(학생 프로필, 조직 프로필/로고)의 커밋 규칙.
 *
 * 프로필 이미지는 MediaFile/쿼터에 등록하지 않는다. purpose=profile presign이
 * 공개 prefix(images/profiles/{userId}/)에 pending 태그로 업로드하고,
 * 엔티티 저장(PATCH students/organizations)이 이 서비스로 커밋(태그 제거)한다.
 * 업로드만 하고 저장하지 않은 객체는 라이프사이클 룰이 회수한다
 * (docs/s3-pending-lifecycle.md 참고).
 */
@Injectable()
export class ProfileImageService {
  constructor(private readonly s3Service: S3Service) {}

  /**
   * 요청된 프로필 이미지 변경을 검증하고 커밋한다.
   *
   * @param userId - 소유자 (키 prefix에 포함되어 크로스테넌트 등록을 차단)
   * @param incoming - 클라이언트가 보낸 값 (undefined=필드 미포함, null/''=제거)
   * @param current - DB에 저장된 현재 값
   */
  async commitChange(
    userId: string,
    incoming: string | null | undefined,
    current: string | null,
  ): Promise<ProfileImageChange> {
    if (incoming === undefined) {
      return { url: undefined, previousUrlToDelete: null };
    }

    if (incoming === null || incoming === '') {
      return { url: null, previousUrlToDelete: current };
    }

    // 미변경(기존 URL 재전송) — 신규 검증보다 먼저 와야 레거시 URL(구 공개 경로,
    // Bunny CDN, CardDAV 업로드 경로)을 그대로 재전송하는 폼 저장이 깨지지 않는다.
    if (incoming === current) {
      return { url: undefined, previousUrlToDelete: null };
    }

    // 신규 이미지: 본인 소유 프로필 prefix의 키인지 검증 후 커밋
    const cdnUrl = process.env.CDN_URL;
    const key = cdnUrl && incoming.startsWith(`${cdnUrl}/`)
      ? incoming.slice(cdnUrl.length + 1)
      : incoming; // CDN_URL 미설정 환경에서는 키가 그대로 저장됨

    // presign이 발급하는 형식({uuid}.{ext}) 그대로만 허용 — 경로 조작 여지 차단
    const keyPrefix = `images/profiles/${userId}/`;
    if (!key.startsWith(keyPrefix)
      || !/^[0-9a-f-]{36}\.[A-Za-z0-9]+$/.test(key.slice(keyPrefix.length))) {
      throw new ForbiddenException('잘못된 이미지 경로입니다.');
    }

    // S3에서 실제 객체를 확인 (존재 여부 + 진짜 크기/타입). 클라이언트 값은 신뢰하지 않음
    const head = await this.s3Service.headObject(key);
    if (!head) {
      throw new BadRequestException('업로드된 이미지를 찾을 수 없습니다.');
    }

    if (
      !head.contentType
      || !SUPPORTED_PROFILE_IMAGE_TYPES.includes(head.contentType)
      || head.contentLength <= 0
      || head.contentLength > MAX_PROFILE_IMAGE_SIZE
    ) {
      // presigned PUT은 실제 타입/크기를 강제하지 않으므로 실측 검증 실패 시 정리
      await this.s3Service.deleteFile(key);
      throw new BadRequestException('지원하지 않는 이미지이거나 크기가 허용 범위를 초과했습니다.');
    }

    // pending 태그 제거 = 커밋. 실패 시 DB 미변경으로 남겨 라이프사이클이 회수하게 한다
    // ("저장됐는데 나중에 삭제되는" 케이스를 구조적으로 차단)
    const tagsCleared = await this.s3Service.clearObjectTags(key);
    if (!tagsCleared) {
      throw new InternalServerErrorException('이미지 저장에 실패했습니다. 다시 시도해주세요.');
    }

    // URL은 신뢰 가능한 키로부터 서버가 재구성
    return {
      url: cdnUrl ? `${cdnUrl}/${key}` : key,
      previousUrlToDelete: current,
    };
  }

  /**
   * 응답 이후 비동기로 객체 삭제 (실패는 로그만 — 태그 없는 고아는 허용)
   */
  scheduleDeletion(url: string | null | undefined): void {
    if (!url) return;
    setImmediate(() => {
      this.s3Service.deleteByUrl(url).catch((err) => {
        console.error('Failed to delete old profile image:', err);
      });
    });
  }
}
