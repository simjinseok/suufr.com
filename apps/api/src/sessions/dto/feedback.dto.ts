import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMediaFileDto } from './create-session.dto';

export class UpsertFeedbackDto {
  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMediaFileDto)
  @IsOptional()
  addNewMediaFiles?: CreateMediaFileDto[];

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  addExistingMediaFileUuids?: string[];

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  removeMediaFileUuids?: string[];
}
