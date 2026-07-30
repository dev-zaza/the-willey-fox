import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EurostatAdapter } from '../adapters/eurostat.adapter';

@Injectable()
export class IngestEurostatJob {
  private readonly logger = new Logger(IngestEurostatJob.name);

  constructor(private readonly adapter: EurostatAdapter) {}

  @Cron('0 4 1 * *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestEurostatJob ingestion');
    try {
      await this.adapter.ingest();
      this.logger.log('IngestEurostatJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestEurostatJob ingestion failed', (err as Error).message);
    }
  }
}
