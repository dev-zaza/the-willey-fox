import {
  IsOptional,
  IsInt,
  IsString,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TierLimitDto {
  @IsInt()
  @Min(0)
  maxQrCodes: number;

  @IsInt()
  @Min(0)
  maxGuardians: number;

  @IsInt()
  @Min(0)
  maxEmergencyContacts: number;

  @IsInt()
  @Min(0)
  maxPinsPerDay: number;
}

class TierLimitsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => TierLimitDto)
  free?: TierLimitDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierLimitDto)
  basic?: TierLimitDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierLimitDto)
  premium?: TierLimitDto;
}

export class UpdatePricingDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  annualPriceCents?: number;

  @IsOptional()
  @IsString()
  monthlyPriceLabel?: string;

  @IsOptional()
  @IsString()
  annualPriceLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  annualSavePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsString()
  stripePriceIdMonthly?: string;

  @IsOptional()
  @IsString()
  stripePriceIdAnnual?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TierLimitsDto)
  tierLimits?: TierLimitsDto;
}
