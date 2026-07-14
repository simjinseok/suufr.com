import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  publicId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  folderUuid?: string;
}
