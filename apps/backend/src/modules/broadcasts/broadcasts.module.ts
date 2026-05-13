import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BroadcastConsentLogService } from './broadcast-consent-log.service';
import { BroadcastEnabledGuard } from './broadcast-enabled.guard';

@Module({
  imports: [ConfigModule],
  providers: [BroadcastConsentLogService, BroadcastEnabledGuard],
  exports: [BroadcastConsentLogService, BroadcastEnabledGuard],
})
export class BroadcastsModule {}
