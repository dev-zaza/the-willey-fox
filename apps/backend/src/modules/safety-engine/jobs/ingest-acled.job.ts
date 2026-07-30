import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AcledConflictConnector } from '../connectors/acled-conflict.connector';

@Injectable()
export class IngestAcledJob {
  private readonly logger = new Logger(IngestAcledJob.name);

  constructor(private readonly connector: AcledConflictConnector) {}

  @Cron('0 1 * * *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestAcledJob ingestion');
    try {
      await this.connector.run();
      this.logger.log('IngestAcledJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestAcledJob ingestion failed', (err as Error).message);
    }
  }
}
