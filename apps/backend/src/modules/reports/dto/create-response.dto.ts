import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateResponseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
