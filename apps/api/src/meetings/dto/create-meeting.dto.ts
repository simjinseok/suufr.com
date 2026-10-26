import { IsString, IsOptional, IsDateString, IsBoolean, IsUUID } from 'class-validator';
import { StrictBoolean } from '../../common/decorators/strict-boolean.decorator';

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
  @StrictBoolean()
  @IsOptional()
  isDone?: boolean;
}
