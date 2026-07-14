import { IsOptional, IsString, IsInt, Min, Max, IsArray, IsUUID, IsTimeZone } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListPaymentsQueryDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return String(value).split(',').map(v => v.trim()).filter(v => v);
  })
  @IsArray()
  @IsString({ each: true })
  organizationUuids?: string[];

  @IsOptional()
  @IsUUID()
  studentUuid?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  year?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  /** 월/연 경계를 계산할 IANA 타임존. 미지정 시 유저 설정 > UTC 순으로 해석. */
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
