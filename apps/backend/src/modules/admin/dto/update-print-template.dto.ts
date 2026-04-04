import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TextSlotsDto } from './text-slots.dto';

export class UpdatePrintTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['wristband', 'square', 'rectangle'])
  formatType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['free', 'basic', 'premium', 'enterprise'])
  tierRequired?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'backgroundColor must be a valid hex color' })
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  @IsIn(['top-left', 'top-right', 'center', 'none'])
  logoPlacement?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  logoSize?: number;

  @IsOptional()
  @IsString()
  @IsIn(['top', 'center', 'bottom'])
  qrPosition?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(400)
  qrSize?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TextSlotsDto)
  textSlots?: TextSlotsDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
