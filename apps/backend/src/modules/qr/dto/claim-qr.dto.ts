import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsEmail,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QR_CATEGORIES } from '@safetag/shared';

export class MedicalInfoDto {
  @IsOptional() @IsString() @MaxLength(500) allergies?: string;
  @IsOptional() @IsString() @MaxLength(10)  bloodType?: string;
  @IsOptional() @IsString() @MaxLength(1000) medicalConditions?: string;
  @IsOptional() @IsString() @MaxLength(1000) medications?: string;
  @IsOptional() @IsString() @MaxLength(200) emergencyContactName?: string;
  @IsOptional() @IsString() @MaxLength(50)  emergencyContactPhone?: string;
  @IsOptional() @IsString() @MaxLength(200) doctorName?: string;
  @IsOptional() @IsString() @MaxLength(50)  doctorPhone?: string;
  @IsOptional() @IsString() @MaxLength(500) insuranceInfo?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class PetInfoDto {
  @IsOptional() @IsString() @MaxLength(100) breed?: string;
  @IsOptional() @IsString() @MaxLength(50)  color?: string;
  @IsOptional() @IsString() @MaxLength(200) vetName?: string;
  @IsOptional() @IsString() @MaxLength(50)  vetPhone?: string;
  @IsOptional() @IsString() @MaxLength(100) microchipId?: string;
}

export class ClaimQrDto {
  @IsIn(QR_CATEGORIES)
  @IsNotEmpty()
  category: (typeof QR_CATEGORIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  ownerContactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ownerContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rewardMessage?: string;

  @IsOptional()
  @IsObject()
  visibilityConfig?: {
    showName?: boolean;
    showPhoto?: boolean;
    showDescription?: boolean;
    showCustomFields?: boolean;
  };

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalInfoDto)
  medicalInfo?: MedicalInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PetInfoDto)
  petInfo?: PetInfoDto;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  familyId?: string;

  @IsOptional()
  @IsUUID()
  mappedMemberId?: string;
}
