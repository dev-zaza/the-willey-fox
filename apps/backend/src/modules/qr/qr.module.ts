import { Module } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';
import { QrAccessGuard } from './guards/qr-access.guard';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SettingsModule, UsersModule],
  controllers: [QrController],
  providers: [QrService, QrAccessGuard],
  exports: [QrService, QrAccessGuard],
})
export class QrModule {}
