import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PublicService } from './public.service';
import { CreateReportDto } from '../reports/dto';
import { ClaimQrDto } from '../qr/dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { Express } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Public()
  @Get('q/:code')
  getQrInfo(@Param('code') code: string) {
    return this.publicService.getPublicQrInfo(code);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('q/:code/report')
  submitReport(
    @Param('code') code: string,
    @Body() dto: CreateReportDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.publicService.submitReport(code, dto, user?.id);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('reports/:reportId/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_SIZE_BYTES } }))
  async uploadReportPhoto(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('FILE_REQUIRED');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('INVALID_FILE_TYPE');
    }
    return this.publicService.uploadReportPhoto(reportId, file.buffer);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('qr/activate')
  activateQrCode(
    @Body() body: ClaimQrDto & { code: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { code, ...dto } = body;
    return this.publicService.activateQrCode(code, user.id, user.tier, dto as ClaimQrDto);
  }
}
