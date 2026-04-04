import { IsString, MaxLength } from 'class-validator';

export class FlagReviewDto {
  @IsString()
  @MaxLength(100)
  reason: string;
}
