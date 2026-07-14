import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { SUPPORTED_UPLOAD_TYPES } from '../../common/constants/file-constraints';

export class CreatePresignedUrlDto {
  // 확장자 필수: S3 키의 ext가 fileName.split('.').pop()에서 나오므로 무확장자 파일명 차단
  @IsString()
  @MaxLength(255)
  @Matches(/\.[A-Za-z0-9]+$/, {
    message: '파일명에 확장자가 필요합니다.',
  })
  fileName!: string;

  @IsIn(SUPPORTED_UPLOAD_TYPES, {
    message: '지원하지 않는 파일 형식입니다.',
  })
  contentType!: string;

  @IsInt()
  @Min(1)
  fileSize!: number;

  // 'profile': MediaFile 미등록 프로필성 이미지 — 공개 prefix 발급, 커밋은 엔티티 저장 시
  @IsOptional()
  @IsIn(['profile'])
  purpose?: 'profile';
}
