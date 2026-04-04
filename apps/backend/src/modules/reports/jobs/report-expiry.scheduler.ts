import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportsService } from '../reports.service';

@Injectable()
export class ReportExpiryScheduler {
  private readonly logger = new Logger(ReportExpiryScheduler.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Run daily at midnight UTC: expire reports older than 30 days with status open/contacted.
   */
  @Cron('0 0 * * *')
  async expireOldReports() {
    this.logger.log('Scheduled: running report expiry');
    const count = await this.reportsService.expireOldReports();
    this.logger.log(`Scheduled expiry complete: ${count} report(s) expired`);
  }
}
