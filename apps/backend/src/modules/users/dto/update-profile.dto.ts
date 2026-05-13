import { IsOptional, IsString, IsObject, IsBoolean, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NotificationPreferencesDto {
  @IsOptional()
  email?: boolean;

  @IsOptional()
  push?: boolean;

  @IsOptional()
  sms?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;

  @IsOptional()
  @IsBoolean()
  safetyMode?: boolean;
}
