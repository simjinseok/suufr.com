import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  @MinLength(1, { message: '파일명을 입력해주세요.' })
  @MaxLength(100, { message: '파일명은 100자를 초과할 수 없습니다.' })
  @Matches(/^[^/\\:*?"<>|]+$/, {
    message: '파일명에 사용할 수 없는 문자가 포함되어 있습니다.',
  })
  fileName!: string;
}
