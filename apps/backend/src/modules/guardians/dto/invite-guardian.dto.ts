import { IsEmail } from 'class-validator';

export class InviteGuardianDto {
  @IsEmail()
  email!: string;
}
