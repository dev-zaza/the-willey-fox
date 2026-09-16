import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { familyGroups } from './family-groups.schema';

export const familyInvites = pgTable(
  'family_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => familyGroups.id, { onDelete: 'cascade' }),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id),
    email: varchar('email', { length: 255 }).notNull(),
    token: varchar('token', { length: 64 }).notNull().unique(),
    role: varchar('role', { length: 20 }).default('member').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | accepted | expired
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_family_invites_token').on(table.token),
    index('idx_family_invites_family_id').on(table.familyId),
  ],
);
