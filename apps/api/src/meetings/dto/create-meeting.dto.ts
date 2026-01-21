import { IsString, IsOptional, IsDateString, IsBoolean, IsUUID } from 'class-validator';

export class CreateMeetingDto {
  @IsUUID()
  organizationUuid!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  meetingAt!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isDone?: boolean;
}
