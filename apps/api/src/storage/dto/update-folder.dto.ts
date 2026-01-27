import { IsString, MaxLength, Matches } from 'class-validator';

export class UpdateFolderDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[가-힣a-zA-Z0-9\s\-_]+$/, {
    message: '폴더명에 특수문자를 사용할 수 없습니다.',
  })
  name!: string;
}
