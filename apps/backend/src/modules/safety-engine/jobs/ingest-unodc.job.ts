import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UnodcGlobalConnector } from '../connectors/unodc-global.connector';

@Injectable()
export class IngestUnodcJob {
  private readonly logger = new Logger(IngestUnodcJob.name);

  constructor(private readonly connector: UnodcGlobalConnector) {}

  @Cron('0 8 1 1 *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestUnodcJob ingestion');
    try {
      await this.connector.run();
      this.logger.log('IngestUnodcJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestUnodcJob ingestion failed', (err as Error).message);
    }
  }
}
