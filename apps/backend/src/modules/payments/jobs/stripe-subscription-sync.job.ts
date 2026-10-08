import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from '../payments.service';

/**
 * Applies Stripe subscription state inside the API process.
 * The container also runs `stripe listen`, but events that arrived before
 * that listener existed never get replayed. This job closes that gap.
 */
@Injectable()
export class StripeSubscriptionSyncJob implements OnModuleInit {
  private readonly logger = new Logger(StripeSubscriptionSyncJob.name);
  private running = false;

  constructor(private readonly paymentsService: PaymentsService) {}

  onModuleInit() {
    void this.sync('startup');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncScheduled() {
    await this.sync('scheduled');
  }

  private async sync(reason: 'startup' | 'scheduled') {
    if (this.running) return;
    this.running = true;
    try {
      const changed = await this.paymentsService.syncPaidSubscriptions();
      if (changed > 0) {
        this.logger.log(`Stripe sync (${reason}): updated ${changed} subscription(s)`);
      }
    } catch (err) {
      this.logger.error(
        `Stripe sync (${reason}) failed`,
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.running = false;
    }
  }
}
