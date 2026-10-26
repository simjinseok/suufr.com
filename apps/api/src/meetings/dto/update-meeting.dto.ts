import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { StrictBoolean } from '../../common/decorators/strict-boolean.decorator';

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
  @StrictBoolean()
  @IsOptional()
  isDone?: boolean;
}
