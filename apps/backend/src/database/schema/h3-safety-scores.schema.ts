import {
  pgTable, text, smallint, numeric, timestamp, unique,
} from 'drizzle-orm/pg-core';

export const h3SafetyScores = pgTable(
  'h3_safety_scores',
  {
    h3Index: text('h3_index').notNull(),
    resolution: smallint('resolution').notNull(),
    score: numeric('score', { precision: 6, scale: 2 }),
    band: text('band'),
    sourceCountry: text('source_country').notNull(),
    lastCalculatedAt: timestamp('last_calculated_at').defaultNow().notNull(),
  },
  (t) => [unique().on(t.h3Index, t.resolution)],
);
