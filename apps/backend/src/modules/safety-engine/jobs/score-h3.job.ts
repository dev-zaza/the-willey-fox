import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { H3Scorer } from '../scoring/h3-scorer';

@Injectable()
export class ScoreH3Job {
  private readonly logger = new Logger(ScoreH3Job.name);

  constructor(private readonly h3Scorer: H3Scorer) {}

  @Cron('0 12 * * *')
  async handle(): Promise<void> {
    this.logger.log('Starting H3 scoring run');
    try {
      const results = await this.h3Scorer.scoreAll();
      this.logger.log(`H3 scoring complete: ${results.length} countries scored`);
    } catch (err) {
      this.logger.error('H3 scoring failed', (err as Error).message);
    }
  }
}
