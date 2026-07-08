import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseFloatPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmergencyService } from './emergency.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddContactDto } from './dto/add-contact.dto';
import { TriggerSosDto } from './dto/trigger-sos.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('JWT')
@ApiTags('emergency')
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  // ─── Emergency Contacts ───────────────────────────────────────────────

  /**
   * GET /api/v1/emergency/contacts
   */
  @Get('contacts')
  listContacts(@CurrentUser() user: { id: string }) {
    return this.emergencyService.listContacts(user.id);
  }

  /**
   * POST /api/v1/emergency/contacts
   * Send a contact request to another user.
   */
  @Post('contacts')
  addContact(
    @CurrentUser() user: { id: string },
    @Body() dto: AddContactDto,
  ) {
    return this.emergencyService.addContact(user.id, dto);
  }

  /**
   * PATCH /api/v1/emergency/contacts/:contactId/accept
   * Accept an incoming emergency contact request.
   */
  @Patch('contacts/:contactId/accept')
  acceptContact(
    @CurrentUser() user: { id: string },
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.emergencyService.acceptContact(contactId, user.id);
  }

  /**
   * PATCH /api/v1/emergency/contacts/:contactId/decline
   * Decline an incoming emergency contact request.
   */
  @Patch('contacts/:contactId/decline')
  declineContact(
    @CurrentUser() user: { id: string },
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.emergencyService.declineContact(contactId, user.id);
  }

  /**
   * PATCH /api/v1/emergency/contacts/:contactId/set-primary
   * Mark one accepted contact as the primary SOS recipient (clears others).
   */
  @Patch('contacts/:contactId/set-primary')
  @HttpCode(HttpStatus.OK)
  setPrimaryContact(
    @CurrentUser() user: { id: string },
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.emergencyService.setPrimaryContact(contactId, user.id);
  }

  /**
   * DELETE /api/v1/emergency/contacts/:contactId
   * Remove an emergency contact (either party can remove).
   */
  @Delete('contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(
    @CurrentUser() user: { id: string },
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.emergencyService.removeContact(contactId, user.id);
  }

  // ─── SOS Alerts ──────────────────────────────────────────────────────

  /**
   * POST /api/v1/emergency/sos
   * Trigger an SOS alert — delivers push + email to all accepted contacts.
   */
  @Post('sos')
  triggerSos(
    @CurrentUser() user: { id: string },
    @Body() dto: TriggerSosDto,
  ) {
    return this.emergencyService.triggerSos(user.id, dto);
  }

  /**
   * PATCH /api/v1/emergency/sos/:alertId/acknowledge
   * Acknowledge an SOS alert (user or their contact).
   */
  @Patch('sos/:alertId/acknowledge')
  acknowledgeSos(
    @CurrentUser() user: { id: string },
    @Param('alertId', ParseUUIDPipe) alertId: string,
  ) {
    return this.emergencyService.acknowledgeSos(alertId, user.id);
  }

  /**
   * GET /api/v1/emergency/sos
   * List the authenticated user's SOS alert history.
   */
  @Get('sos')
  listSosAlerts(@CurrentUser() user: { id: string }) {
    return this.emergencyService.listSosAlerts(user.id);
  }

  /**
   * GET /api/v1/emergency/active-near?lat=&lng=&radius=
   * Get active (unacknowledged) SOS alerts within a radius (metres).
   */
  @Get('active-near')
  getActiveSosNear(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', new DefaultValuePipe(2000), ParseIntPipe) radius: number,
  ) {
    return this.emergencyService.getActiveSosNear(lat, lng, radius);
  }
}
