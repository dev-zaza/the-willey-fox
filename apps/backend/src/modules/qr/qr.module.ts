import { Module } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { QrAccessGuard } from './guards/qr-access.guard';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [QrController],
  providers: [QrService, QrAccessGuard],
  exports: [QrService, QrAccessGuard],
})
export class QrModule {}
