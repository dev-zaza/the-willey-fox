import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { TagCustomizationService } from './tag-customization.service';
import { PrintExportService } from './print-export.service';
import { AccountDeletionJob } from './jobs/account-deletion.job';
import { QrModule } from '../qr/qr.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BroadcastsModule } from '../broadcasts/broadcasts.module';
import { SafetyEngineModule } from '../safety-engine/safety-engine.module';

@Module({
  imports: [ConfigModule, QrModule, SettingsModule, NotificationsModule, BroadcastsModule, SafetyEngineModule],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService, TagCustomizationService, PrintExportService, AccountDeletionJob],
})
export class AdminModule {}
