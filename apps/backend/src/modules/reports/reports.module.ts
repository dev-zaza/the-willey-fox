import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportExpiryScheduler } from './jobs/report-expiry.scheduler';

@Module({
  imports: [NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExpiryScheduler],
  exports: [ReportsService],
})
export class ReportsModule {}
