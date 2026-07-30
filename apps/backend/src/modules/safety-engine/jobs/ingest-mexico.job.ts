import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MexicoHoyodecrimenConnector } from '../connectors/mexico-hoyodecrimen.connector';

@Injectable()
export class IngestMexicoJob {
  private readonly logger = new Logger(IngestMexicoJob.name);

  constructor(private readonly connector: MexicoHoyodecrimenConnector) {}

  @Cron('0 7 * * *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestMexicoJob ingestion');
    try {
      await this.connector.run();
      this.logger.log('IngestMexicoJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestMexicoJob ingestion failed', (err as Error).message);
    }
  }
}
