import { IsString, IsOptional } from 'class-validator';

export class UpsertFeedbackDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
