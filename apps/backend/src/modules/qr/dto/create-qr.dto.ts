import { IsIn, IsNotEmpty, IsOptional, IsString, IsObject, IsEmail, MaxLength } from 'class-validator';
import { QR_CATEGORIES } from '@safetag/shared';

export class CreateQrDto {
  @IsIn(QR_CATEGORIES)
  @IsNotEmpty()
  category: (typeof QR_CATEGORIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  ownerContactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownerContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rewardMessage?: string;

  @IsOptional()
  @IsObject()
  visibilityConfig?: {
    showName?: boolean;
    showPhoto?: boolean;
    showDescription?: boolean;
    showCustomFields?: boolean;
  };

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
