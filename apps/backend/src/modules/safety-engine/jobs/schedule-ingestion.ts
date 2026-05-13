import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SafetyEngineService } from '../safety-engine.service';

@Injectable()
export class ScheduleIngestionJob {
  private readonly logger = new Logger(ScheduleIngestionJob.name);

  constructor(private readonly safetyEngineService: SafetyEngineService) {}

  /**
   * UK Police: monthly on 2nd of each month at 02:00 UTC.
   * ~2 month lag on their data so running monthly is sufficient.
   */
  @Cron('0 2 2 * *')
  async runUkPoliceIngestion() {
    this.logger.log('Scheduled: triggering UK Police ingestion');
    await this.safetyEngineService.triggerIngestion('uk_police');
  }

  /**
   * Eurostat: annually on Jan 15 at 03:00 UTC.
   * Annual dataset — no point running more frequently.
   */
  @Cron('0 3 15 1 *')
  async runEurostatIngestion() {
    this.logger.log('Scheduled: triggering Eurostat ingestion');
    await this.safetyEngineService.triggerIngestion('eurostat');
  }

  /**
   * FBI: monthly on 5th of each month at 04:00 UTC.
   */
  @Cron('0 4 5 * *')
  async runFbiIngestion() {
    this.logger.log('Scheduled: triggering FBI ingestion');
    await this.safetyEngineService.triggerIngestion('fbi');
  }

  /**
   * US Travel Advisory: quarterly on 1st of Jan/Apr/Jul/Oct at 05:00 UTC.
   * Advisory data updates irregularly; quarterly refresh is sufficient.
   */
  @Cron('0 5 1 1,4,7,10 *')
  async runTravelAdvisoryIngestion() {
    this.logger.log('Scheduled: triggering US Travel Advisory ingestion');
    await this.safetyEngineService.triggerIngestion('us_travel_advisory');
  }
}
