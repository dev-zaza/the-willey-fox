import { IsString, MinLength, MaxLength, IsOptional, IsUUID } from 'class-validator';

export class ReportUserDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contextType?: string;

  @IsOptional()
  @IsUUID()
  contextId?: string;
}
