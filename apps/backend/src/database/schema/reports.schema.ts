import { pgTable, uuid, varchar, timestamp, numeric, index, boolean, smallint } from 'drizzle-orm/pg-core';
import { reportStatusEnum } from './enums';
import { users } from './users.schema';
import { qrCodes } from './qr-codes.schema';

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    qrCodeId: uuid('qr_code_id')
      .notNull()
      .references(() => qrCodes.id, { onDelete: 'cascade' }),
    finderUserId: uuid('finder_user_id').references(() => users.id),
    finderContact: varchar('finder_contact', { length: 255 }),
    finderNotes: varchar('finder_notes', { length: 2000 }),
    locationLat: numeric('location_lat', { precision: 10, scale: 7 }),
    locationLng: numeric('location_lng', { precision: 10, scale: 7 }),
    locationAddress: varchar('location_address', { length: 500 }),
    photoUrl: varchar('photo_url', { length: 1000 }),
    status: reportStatusEnum('status').default('open').notNull(),
    flagReason: varchar('flag_reason', { length: 500 }),
    isPublicBroadcast: boolean('is_public_broadcast').default(false).notNull(),
    broadcastApprovedAt: timestamp('broadcast_approved_at', { withTimezone: true }),
    broadcastExpiresAt: timestamp('broadcast_expires_at', { withTimezone: true }),
    broadcastExtendCount: smallint('broadcast_extend_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_reports_qr_code_id').on(table.qrCodeId),
    index('idx_reports_finder_user_id').on(table.finderUserId),
    index('idx_reports_broadcast_active').on(table.isPublicBroadcast, table.broadcastExpiresAt),
  ],
);
