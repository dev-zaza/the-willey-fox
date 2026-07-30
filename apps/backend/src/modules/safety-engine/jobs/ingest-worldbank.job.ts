import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WorldbankGlobalConnector } from '../connectors/worldbank-global.connector';

@Injectable()
export class IngestWorldbankJob {
  private readonly logger = new Logger(IngestWorldbankJob.name);

  constructor(private readonly connector: WorldbankGlobalConnector) {}

  @Cron('0 9 1 1 *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestWorldbankJob ingestion');
    try {
      await this.connector.run();
      this.logger.log('IngestWorldbankJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestWorldbankJob ingestion failed', (err as Error).message);
    }
  }
}
