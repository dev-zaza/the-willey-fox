-- 0019_travel_advisory.sql
-- Add 'us_travel_advisory' to safety_source enum for travel advisory integration

ALTER TYPE safety_source ADD VALUE IF NOT EXISTS 'us_travel_advisory';
