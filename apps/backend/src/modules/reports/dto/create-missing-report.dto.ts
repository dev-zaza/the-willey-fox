import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateMissingReportDto {
  @IsUUID()
  qrCodeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  lastSeenLocation?: string;

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
  @IsBoolean()
  requestBroadcast?: boolean;
}
