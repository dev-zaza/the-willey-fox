import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { qrCodes } from './qr-codes.schema';

export const guardianInvites = pgTable(
  'guardian_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    qrCodeId: uuid('qr_code_id')
      .notNull()
      .references(() => qrCodes.id, { onDelete: 'cascade' }),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id),
    email: varchar('email', { length: 255 }).notNull(),
    token: varchar('token', { length: 64 }).notNull().unique(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | accepted | expired
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_guardian_invites_token').on(table.token),
    index('idx_guardian_invites_qr_code_id').on(table.qrCodeId),
  ],
);
