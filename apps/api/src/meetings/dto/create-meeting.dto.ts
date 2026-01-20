import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateMeetingDto {
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
