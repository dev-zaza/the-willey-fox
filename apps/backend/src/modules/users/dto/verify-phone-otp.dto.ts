import { IsString, Length } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
