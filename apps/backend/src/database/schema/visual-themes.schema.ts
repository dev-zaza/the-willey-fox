import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const visualThemes = pgTable('visual_themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  accentColor: varchar('accent_color', { length: 7 }).default('#f97316').notNull(),
  backgroundStyle: varchar('background_style', { length: 10 }).default('light').notNull(),
  showLogo: boolean('show_logo').default(true).notNull(),
  logoUrl: varchar('logo_url', { length: 500 }),
  tierRequired: varchar('tier_required', { length: 20 }).default('free').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
