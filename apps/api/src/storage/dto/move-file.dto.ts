import { IsString, IsOptional } from 'class-validator';

export class MoveFileDto {
  @IsOptional()
  @IsString()
  folderUuid?: string | null;
}
