import { IsString } from 'class-validator';

export class CreateStudentCommentDto {
  @IsString()
  content!: string;
}
