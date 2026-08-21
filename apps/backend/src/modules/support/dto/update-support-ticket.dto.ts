import { IsIn, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status?: string;

  @IsOptional()
  @IsNotEmpty()
  @MaxLength(5000)
  adminReply?: string;
}
