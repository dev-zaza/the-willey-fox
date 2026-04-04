import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class TriggerSosDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
