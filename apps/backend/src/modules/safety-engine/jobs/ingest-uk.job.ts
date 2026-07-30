import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UkPoliceAdapter } from '../adapters/uk-police.adapter';

@Injectable()
export class IngestUkJob {
  private readonly logger = new Logger(IngestUkJob.name);

  constructor(private readonly adapter: UkPoliceAdapter) {}

  @Cron('0 2 * * *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestUkJob ingestion');
    try {
      await this.adapter.ingest();
      this.logger.log('IngestUkJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestUkJob ingestion failed', (err as Error).message);
    }
  }
}
