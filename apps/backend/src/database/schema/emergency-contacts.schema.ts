import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { emergencyContactStatusEnum } from './enums';
import { users } from './users.schema';

export const emergencyContacts = pgTable('emergency_contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contactUserId: uuid('contact_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: emergencyContactStatusEnum('status').default('pending').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  uqUserContact: unique('uq_emergency_contact').on(t.userId, t.contactUserId),
}));
