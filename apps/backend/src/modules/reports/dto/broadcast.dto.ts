import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EnableBroadcastDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tosVersion?: string;
}

export class DisableBroadcastDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
