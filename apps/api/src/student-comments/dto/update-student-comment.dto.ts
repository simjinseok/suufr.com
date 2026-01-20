import { IsString, IsOptional } from 'class-validator';

export class UpdateStudentCommentDto {
  @IsString()
  @IsOptional()
  content?: string;
}
