import { IsUUID } from 'class-validator';

export class AddQrToFamilyDto {
  @IsUUID()
  qrCodeId: string;
}
