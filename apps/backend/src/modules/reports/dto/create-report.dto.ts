import { IsOptional, IsString, IsNumber, MaxLength, Min, Max } from 'class-validator';

export class CreateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  finderContact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  finderNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationAddress?: string;
}
