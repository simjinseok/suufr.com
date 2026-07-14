import { IsOptional, IsString, IsInt, Min, Max, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListInvoicesQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return String(value).split(',').map(v => v.trim()).filter(v => v);
  })
  @IsArray()
  @IsString({ each: true })
  organizationUuids?: string[];

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  studentUuid?: string;
}
