import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QrService } from './qr.service';
import { QrAccessGuard } from './guards/qr-access.guard';
import { CreateQrDto, UpdateQrDto, BulkCreateQrDto } from './dto';
import { SetQrThemeDto } from './dto/set-qr-theme.dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('JWT')
@ApiTags('qr-codes')
@Controller('qr-codes')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQrDto) {
    return this.qrService.create(user.id, user.tier, dto);
  }

  @Post('bulk')
  bulkCreate(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkCreateQrDto) {
    return this.qrService.bulkCreate(user.id, user.tier, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.qrService.findAllByUser(user.id);
  }

  @UseGuards(QrAccessGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.qrService.findById(id);
  }

  @UseGuards(QrAccessGuard)
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQrDto,
  ) {
    return this.qrService.update(id, dto);
  }

  @UseGuards(QrAccessGuard)
  @Patch(':id')
  partialUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQrDto,
  ) {
    return this.qrService.update(id, dto);
  }

  @UseGuards(QrAccessGuard)
  @Post(':id/mark-lost')
  markLost(@Param('id', ParseUUIDPipe) id: string) {
    return this.qrService.markLost(id);
  }

  @UseGuards(QrAccessGuard)
  @Post(':id/mark-found')
  markFound(@Param('id', ParseUUIDPipe) id: string) {
    return this.qrService.markFound(id);
  }

  @UseGuards(QrAccessGuard)
  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.qrService.deactivate(id);
  }

  @Patch(':id/theme')
  setTheme(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetQrThemeDto,
  ) {
    return this.qrService.setTheme(id, user.id, user.tier, dto);
  }

  @UseGuards(QrAccessGuard)
  @Get(':id/download')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const qrCode = await this.qrService.findById(id);
    if (!qrCode) {
      res.status(404).json({ message: 'QR_NOT_FOUND' });
      return;
    }

    const imageBuffer = await this.qrService.generateQrImage(qrCode.uniqueCode);

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="safetag-${qrCode.uniqueCode}.png"`,
      'Content-Length': imageBuffer.length.toString(),
    });

    res.send(imageBuffer);
  }
}
