import { IsString, MaxLength } from 'class-validator';

export class CreateFamilyDto {
  @IsString()
  @MaxLength(200)
  name: string;
}
