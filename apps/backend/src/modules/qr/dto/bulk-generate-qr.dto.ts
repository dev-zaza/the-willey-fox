import { IsInt, IsOptional, IsString, IsIn, MaxLength, Min, Max } from 'class-validator';
import { QR_PRODUCT_TYPE_KEYS } from '../qr-product-types';

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

  @IsOptional()
  @IsIn(QR_PRODUCT_TYPE_KEYS)
  productType?: string;
}
