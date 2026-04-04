import { IsEnum } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsEnum(['monthly', 'annual'])
  interval!: 'monthly' | 'annual';
}
