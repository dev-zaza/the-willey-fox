import {
  pgTable, uuid, text, integer, real, date, timestamp, unique,
} from 'drizzle-orm/pg-core';

export const crimeIncidents = pgTable(
  'crime_incidents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceCountry: text('source_country').notNull(),
    sourceApi: text('source_api').notNull(),
    sourceRecordId: text('source_record_id').notNull(),
    crimeType: text('crime_type').notNull(),
    severityCategory: text('severity_category').notNull(),
    incidentCount: integer('incident_count').default(1).notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    h3IndexR7: text('h3_index_r7'),
    h3IndexR9: text('h3_index_r9'),
    h3IndexR11: text('h3_index_r11'),
    incidentDate: date('incident_date'),
    ingestedAt: timestamp('ingested_at').defaultNow().notNull(),
  },
  (t) => [unique().on(t.sourceApi, t.sourceRecordId)],
);
