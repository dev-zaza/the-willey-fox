import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QrAccessGuard } from '../qr/guards/qr-access.guard';
import { GuardiansService } from './guardians.service';
import { InviteGuardianDto } from './dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Top-level accept endpoint so the web page and deep links can call
 * POST /guardians/invite/accept without knowing the QR code UUID.
 * The token itself encodes the invite (and thus the qrCodeId).
 */
@ApiBearerAuth('JWT')
@ApiTags('guardians')
@Controller('guardians')
export class GuardianInviteController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Post('invite/accept')
  acceptInviteGlobal(
    @Body() body: { token: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guardiansService.acceptInvite(body.token, user.id);
  }
}

@Controller('qr-codes/:id/guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @UseGuards(QrAccessGuard)
  @Get()
  listGuardians(@Param('id', ParseUUIDPipe) id: string) {
    return this.guardiansService.listGuardians(id);
  }

  @Post('request')
  requestAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guardiansService.requestAccess(id, user.id);
  }

  // Literal routes before parameterised :userId routes to avoid mismatching
  @UseGuards(QrAccessGuard)
  @Post('invite')
  inviteGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteGuardianDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guardiansService.inviteGuardianByEmail(id, user.id, dto);
  }

  @Post('invite/accept')
  acceptInvite(
    @Body() body: { token: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guardiansService.acceptInvite(body.token, user.id);
  }

  @UseGuards(QrAccessGuard)
  @Post(':userId/approve')
  approveGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guardiansService.approveGuardian(id, userId, user.id);
  }

  @UseGuards(QrAccessGuard)
  @Post(':userId/reject')
  rejectGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.guardiansService.rejectGuardian(id, userId, user.id);
  }

  @UseGuards(QrAccessGuard)
  @Delete(':userId')
  removeGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.guardiansService.removeGuardian(id, userId);
  }
}
