import { pgTable, uuid, varchar, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const familyGroups = pgTable(
  'family_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    ownerId: uuid('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_family_groups_owner').on(table.ownerId),
  ],
);

export const familyMembers = pgTable(
  'family_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familyId: uuid('family_id')
      .references(() => familyGroups.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 20 }).default('member').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    unique('uq_family_member').on(table.familyId, table.userId),
    index('idx_family_members_family').on(table.familyId),
    index('idx_family_members_user').on(table.userId),
  ],
);
