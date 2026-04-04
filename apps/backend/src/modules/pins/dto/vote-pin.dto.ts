import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class VotePinDto {
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isUpvote: boolean;
}
