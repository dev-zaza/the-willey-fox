import { pgTable, uuid, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { guardianStatusEnum } from './enums';
import { users } from './users.schema';
import { qrCodes } from './qr-codes.schema';

export const guardianMappings = pgTable(
  'guardian_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    qrCodeId: uuid('qr_code_id')
      .notNull()
      .references(() => qrCodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: guardianStatusEnum('status').default('pending').notNull(),
    addedBy: uuid('added_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('uq_guardian_qr_user').on(table.qrCodeId, table.userId),
    index('idx_guardian_mappings_qr_code_id').on(table.qrCodeId),
    index('idx_guardian_mappings_user_id').on(table.userId),
  ],
);
