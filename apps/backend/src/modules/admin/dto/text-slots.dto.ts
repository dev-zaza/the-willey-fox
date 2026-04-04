import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class TextSlotsDto {
  @IsOptional()
  @IsBoolean()
  showTagName?: boolean;

  @IsOptional()
  @IsBoolean()
  showInstructions?: boolean;

  @IsOptional()
  @IsString()
  instructionsText?: string;

  @IsOptional()
  @IsBoolean()
  showReward?: boolean;

  @IsOptional()
  @IsString()
  tagNamePosition?: string;

  @IsOptional()
  @IsString()
  instructionsPosition?: string;
}
