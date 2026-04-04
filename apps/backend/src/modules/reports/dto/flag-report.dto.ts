import { IsString, MaxLength } from 'class-validator';

export class FlagReportDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
