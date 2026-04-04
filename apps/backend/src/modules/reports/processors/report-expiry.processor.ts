import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReportsService } from '../reports.service';

export const REPORT_EXPIRY_QUEUE = 'report-expiry';

@Processor(REPORT_EXPIRY_QUEUE)
export class ReportExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportExpiryProcessor.name);

  constructor(private readonly reportsService: ReportsService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.debug('Processing report expiry job');
    const count = await this.reportsService.expireOldReports();
    this.logger.log(`Report expiry: ${count} report(s) marked as expired`);
  }
}
