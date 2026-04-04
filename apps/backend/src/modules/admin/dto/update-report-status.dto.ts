import { IsIn } from 'class-validator';

export class UpdateReportStatusDto {
  @IsIn(['active', 'resolved', 'dismissed', 'flagged', 'open', 'contacted', 'closed'])
  status!: string;
}
