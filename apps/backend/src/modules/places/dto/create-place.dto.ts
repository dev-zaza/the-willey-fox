import { IsString, IsNotEmpty, IsIn, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PLACE_TYPES } from '@safetag/shared';

export class CreatePlaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsIn(PLACE_TYPES)
  category: string;

  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mapboxPoiId?: string;
}
