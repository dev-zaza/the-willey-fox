import { IsEmail, IsUUID, ValidateIf } from 'class-validator';

export class AddContactDto {
  /** Resolve contact by user ID (internal use, e.g. from search results) */
  @ValidateIf((o) => !o.contactEmail)
  @IsUUID()
  contactUserId?: string;

  /** Resolve contact by registered email — preferred for UX */
  @ValidateIf((o) => !o.contactUserId)
  @IsEmail()
  contactEmail?: string;
}
