import { IsOptional, IsUUID } from 'class-validator';

export class SetQrThemeDto {
  @IsOptional()
  @IsUUID()
  themeId?: string | null;
}
