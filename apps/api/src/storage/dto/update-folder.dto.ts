import { IsString, MaxLength, Matches } from 'class-validator';

export class UpdateFolderDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[가-힣a-zA-Z0-9\s\-_\(\)\[\]]+$/, {
    message: '폴더명에 허용되지 않는 특수문자가 포함되어 있습니다.',
  })
  name!: string;
}
