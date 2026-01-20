import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class UpdateMeetingDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  meetingAt?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isDone?: boolean;
}
