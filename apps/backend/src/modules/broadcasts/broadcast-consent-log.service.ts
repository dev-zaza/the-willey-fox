import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { broadcastConsentLog } from '../../database/schema';
import type { BroadcastConsentAction } from '../../database/schema';

export interface ConsentLogEntry {
  reportId: string;
  guardianUserId?: string | null;
  action: BroadcastConsentAction;
  ipAddress?: string | null;
  userAgent?: string | null;
  tosVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class BroadcastConsentLogService {
  private readonly logger = new Logger(BroadcastConsentLogService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async log(entry: ConsentLogEntry): Promise<void> {
    try {
      await this.db.insert(broadcastConsentLog).values({
        reportId: entry.reportId,
        guardianUserId: entry.guardianUserId ?? null,
        action: entry.action,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        tosVersion: entry.tosVersion ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Failed to write broadcast consent log for report ${entry.reportId} action ${entry.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async getForReport(reportId: string) {
    return this.db
      .select()
      .from(broadcastConsentLog)
      .where(eq(broadcastConsentLog.reportId, reportId))
      .orderBy(desc(broadcastConsentLog.createdAt));
  }
}
