import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddQrToFamilyDto } from './dto/add-qr-to-family.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('JWT')
@ApiTags('families')
@Controller('families')
@UseGuards(AuthGuard('jwt'))
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateFamilyDto) {
    return this.familiesService.create(userId, dto.name);
  }

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.familiesService.listForUser(userId);
  }

  @Get(':id')
  async getById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) familyId: string,
  ) {
    return this.familiesService.getById(familyId, userId);
  }

  @Post(':id/members')
  async addMember(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) familyId: string,
    @Body() dto: AddMemberDto,
  ) {
    if (dto.email) {
      return this.familiesService.addMemberByEmail(familyId, userId, dto.email);
    }
    if (dto.userId) {
      return this.familiesService.addMember(familyId, userId, dto.userId);
    }
    return { error: 'Provide either userId or email' };
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) familyId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    await this.familiesService.removeMember(familyId, requesterId, targetUserId);
    return { success: true };
  }

  @Post(':id/qr-codes')
  async addQrToFamily(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) familyId: string,
    @Body() dto: AddQrToFamilyDto,
  ) {
    await this.familiesService.addQrToFamily(familyId, userId, dto.qrCodeId);
    return { success: true };
  }

  @Delete(':id/qr-codes/:qrCodeId')
  async removeQrFromFamily(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) familyId: string,
    @Param('qrCodeId', ParseUUIDPipe) qrCodeId: string,
  ) {
    await this.familiesService.removeQrFromFamily(familyId, userId, qrCodeId);
    return { success: true };
  }

  @Delete(':id')
  async deleteFamily(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) familyId: string,
  ) {
    await this.familiesService.deleteFamily(familyId, userId);
    return { success: true };
  }
}
