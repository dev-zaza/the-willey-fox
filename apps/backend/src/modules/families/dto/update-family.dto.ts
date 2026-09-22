import { IsString, MaxLength } from 'class-validator';

export class UpdateFamilyDto {
  @IsString()
  @MaxLength(200)
  name: string;
}
