import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleMobileDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}
