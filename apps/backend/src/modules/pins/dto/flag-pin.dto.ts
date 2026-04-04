import { IsString, MinLength, MaxLength } from 'class-validator';

export class FlagPinDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
