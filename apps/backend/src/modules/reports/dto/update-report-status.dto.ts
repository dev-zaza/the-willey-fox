import { IsEnum, IsNotEmpty } from 'class-validator';
import { REPORT_STATUSES } from '@safetag/shared';

export class UpdateReportStatusDto {
  @IsEnum(REPORT_STATUSES)
  @IsNotEmpty()
  status: (typeof REPORT_STATUSES)[number];
}
