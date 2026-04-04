import { Module } from '@nestjs/common';
import { QrModule } from '../qr/qr.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { GuardiansService } from './guardians.service';
import { GuardiansController, GuardianInviteController } from './guardians.controller';

@Module({
  imports: [QrModule, NotificationsModule, SettingsModule, UsersModule],
  controllers: [GuardiansController, GuardianInviteController],
  providers: [GuardiansService],
  exports: [GuardiansService],
})
export class GuardiansModule {}
