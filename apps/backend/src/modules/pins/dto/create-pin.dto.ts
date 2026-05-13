import { IsIn, IsString, IsOptional, IsNumber, Min, Max, MaxLength, IsDateString } from 'class-validator';

// Keep in sync with PIN_TYPES in @safetag/shared
const PIN_TYPES = ['hazard', 'roadblock', 'construction', 'safety_alert', 'traffic', 'event', 'pickpocket', 'recommendation', 'harassment', 'unsafe_area', 'other'] as const;
type PinType = (typeof PIN_TYPES)[number];

export class CreatePinDto {
  @IsIn(PIN_TYPES)
  type: PinType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  /**
   * Optional custom expiry for events. Ignored for other pin types.
   * Traffic/hazard/safety_alert auto-expire at 4h. Construction never expires.
   */
  @IsOptional()
  @IsDateString()
  eventEndTime?: string;
}
