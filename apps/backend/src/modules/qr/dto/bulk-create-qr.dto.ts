import { IsIn, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { QR_CATEGORIES } from '@safetag/shared';

export class BulkCreateQrDto {
  @IsInt()
  @Min(1)
  @Max(50)
  count: number;

  @IsIn(QR_CATEGORIES)
  @IsNotEmpty()
  category: (typeof QR_CATEGORIES)[number];
}
