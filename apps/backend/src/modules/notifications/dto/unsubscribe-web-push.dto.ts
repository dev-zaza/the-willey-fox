import { IsNotEmpty, IsString } from 'class-validator';

export class UnsubscribeWebPushDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}
