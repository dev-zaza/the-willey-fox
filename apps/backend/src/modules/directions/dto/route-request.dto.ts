import { IsNumber, IsOptional, IsDateString, IsEnum, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class CoordinateDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

class RoutePreferencesDto {
  @IsOptional()
  @IsEnum(['safety', 'speed', 'balanced'])
  prioritize?: 'safety' | 'speed' | 'balanced';
}

export class RouteRequestDto {
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @ValidateNested()
  @Type(() => CoordinateDto)
  destination: CoordinateDto;

  @IsOptional()
  @IsDateString()
  departureTime?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RoutePreferencesDto)
  preferences?: RoutePreferencesDto;
}
