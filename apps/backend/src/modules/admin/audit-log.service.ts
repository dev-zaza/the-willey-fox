import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { adminAuditLogs } from '../../database/schema';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Fire-and-forget audit log entry. Never throws.
   */
  log(
    adminId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    metadata?: object,
  ): void {
    this.db
      .insert(adminAuditLogs)
      .values({
        adminId,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        metadata: metadata ?? null,
        createdAt: new Date(),
      })
      .catch((err) => {
        this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
      });
  }
}
