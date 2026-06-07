import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { TagCustomizationService } from './tag-customization.service';
import { QrModule } from '../qr/qr.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BroadcastsModule } from '../broadcasts/broadcasts.module';
import { SafetyEngineModule } from '../safety-engine/safety-engine.module';

@Module({
  imports: [QrModule, SettingsModule, NotificationsModule, BroadcastsModule, SafetyEngineModule],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService, TagCustomizationService],
})
export class AdminModule {}
