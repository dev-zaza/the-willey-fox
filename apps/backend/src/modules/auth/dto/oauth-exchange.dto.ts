import { IsNotEmpty, IsString, Length } from 'class-validator';

export class OAuthExchangeDto {
  @IsString()
  @IsNotEmpty()
  @Length(16, 64)
  code!: string;
}
