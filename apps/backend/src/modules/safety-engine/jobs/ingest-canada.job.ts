import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CanadaStatcanConnector } from '../connectors/canada-statcan.connector';

@Injectable()
export class IngestCanadaJob {
  private readonly logger = new Logger(IngestCanadaJob.name);

  constructor(private readonly connector: CanadaStatcanConnector) {}

  @Cron('0 6 1 */3 *')
  async handle(): Promise<void> {
    this.logger.log('Starting IngestCanadaJob ingestion');
    try {
      await this.connector.run();
      this.logger.log('IngestCanadaJob ingestion complete');
    } catch (err) {
      this.logger.error('IngestCanadaJob ingestion failed', (err as Error).message);
    }
  }
}
