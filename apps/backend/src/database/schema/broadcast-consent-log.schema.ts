import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { reports } from './reports.schema';
import { users } from './users.schema';

export const broadcastConsentLog = pgTable(
  'broadcast_consent_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    guardianUserId: uuid('guardian_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    tosVersion: text('tos_version'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_broadcast_consent_log_report').on(table.reportId),
    index('idx_broadcast_consent_log_guardian').on(table.guardianUserId),
  ],
);

export type BroadcastConsentAction =
  | 'enable'
  | 'disable'
  | 'extend'
  | 'auto_retract_found'
  | 'auto_retract_user_delete'
  | 'auto_expire'
  | 'admin_takedown';
