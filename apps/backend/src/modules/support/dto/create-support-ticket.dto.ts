import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}
