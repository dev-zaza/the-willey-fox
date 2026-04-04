import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  Matches,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateVisualThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'accentColor must be a valid hex color' })
  accentColor?: string;

  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark'])
  backgroundStyle?: string;

  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['free', 'basic', 'premium', 'enterprise'])
  tierRequired?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
