import { IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class BulkGenerateQrDto {
  @IsInt()
  @Min(1)
  @Max(500)
  count: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shopifyOrderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
