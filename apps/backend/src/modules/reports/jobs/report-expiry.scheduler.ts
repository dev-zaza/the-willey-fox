import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportsService } from '../reports.service';

@Injectable()
export class ReportExpiryScheduler {
  private readonly logger = new Logger(ReportExpiryScheduler.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Cron('0 0 * * *')
  async runDailyExpiry() {
    this.logger.log('Scheduled: running report + broadcast expiry sweep');
    try {
      const reportsCount = await this.reportsService.expireOldReports();
      this.logger.log(`Scheduled expiry: ${reportsCount} report(s) marked expired`);
    } catch (err) {
      this.logger.error(
        'Report expiry sweep failed',
        err instanceof Error ? err.stack : String(err),
      );
    }

    try {
      const { total, failed } = await this.reportsService.expireBroadcasts();
      this.logger.log(`Scheduled expiry: ${total} broadcast(s) expired, ${failed} failed`);
    } catch (err) {
      this.logger.error(
        'Broadcast expiry sweep failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
