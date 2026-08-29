import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { QR_PRODUCT_TYPE_KEYS } from '../../qr/qr-product-types';

export class CreateShopifyMappingDto {
  @IsString()
  @MaxLength(64)
  shopifyProductId: string;

  @IsIn(QR_PRODUCT_TYPE_KEYS)
  productType: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

export class AssignShopifyQrDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  qrCodeIds: string[];
}
