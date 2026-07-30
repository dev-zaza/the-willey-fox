import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AustraliaAbsConnector } from '../connectors/australia-abs.connector';

@Injectable()
export class IngestAustraliaJob {
  private readonly logger = new Logger(IngestAustraliaJob.name);

  constructor(private readonly connector: AustraliaAbsConnector) {}

  @Cron('0 5 1 */3 *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestAustraliaJob ingestion');
    try {
      await this.connector.run();
      this.logger.log('IngestAustraliaJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestAustraliaJob ingestion failed', (err as Error).message);
    }
  }
}
