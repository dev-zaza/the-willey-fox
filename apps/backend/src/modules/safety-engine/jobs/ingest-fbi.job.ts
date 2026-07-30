import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FbiAdapter } from '../adapters/fbi.adapter';

@Injectable()
export class IngestFbiJob {
  private readonly logger = new Logger(IngestFbiJob.name);

  constructor(private readonly adapter: FbiAdapter) {}

  @Cron('0 3 1 * *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestFbiJob ingestion');
    try {
      await this.adapter.ingest();
      this.logger.log('IngestFbiJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestFbiJob ingestion failed', (err as Error).message);
    }
  }
}
