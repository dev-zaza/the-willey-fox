import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum BillingInterval {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

export class CreateCheckoutDto {
  @IsEnum(BillingInterval)
  interval: BillingInterval;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  successUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelUrl?: string;
}
