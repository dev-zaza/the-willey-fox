import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, lte } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { users, appSettings } from '../../../database/schema';

@Injectable()
export class AccountDeletionJob {
  private readonly logger = new Logger(AccountDeletionJob.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // Runs daily at 03:00 UTC
  @Cron('0 3 * * *')
  async handle(): Promise<void> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'account_deletion'))
      .limit(1);

    const autoDeleteEnabled = ((row?.value ?? {}) as { autoDeleteEnabled?: boolean }).autoDeleteEnabled ?? false;

    if (!autoDeleteEnabled) {
      this.logger.debug('AccountDeletionJob: auto-delete disabled, skipping');
      return;
    }

    const now = new Date();

    const due = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(lte(users.deletionScheduledAt, now));

    if (due.length === 0) {
      this.logger.log('AccountDeletionJob: no accounts due for deletion');
      return;
    }

    this.logger.log(`AccountDeletionJob: deleting ${due.length} account(s)`);

    for (const user of due) {
      try {
        await this.db.delete(users).where(eq(users.id, user.id));
        this.logger.log(`AccountDeletionJob: deleted user ${user.id} (${user.email})`);
      } catch (err) {
        this.logger.error(`AccountDeletionJob: failed to delete user ${user.id}`, (err as Error).message);
      }
    }

    this.logger.log(`AccountDeletionJob: completed — ${due.length} account(s) processed`);
  }
}
