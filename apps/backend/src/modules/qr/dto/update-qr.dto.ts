import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateQrDto } from './create-qr.dto';

export class UpdateQrDto extends PartialType(CreateQrDto) {
  @IsOptional()
  @IsBoolean()
  isLost?: boolean;
}
