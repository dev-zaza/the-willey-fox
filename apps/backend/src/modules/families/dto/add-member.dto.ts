import { IsUUID, IsOptional, IsEmail } from 'class-validator';

export class AddMemberDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
