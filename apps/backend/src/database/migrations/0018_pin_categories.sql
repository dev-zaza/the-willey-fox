-- 0018_pin_categories.sql
-- Add 'pickpocket' and 'recommendation' to pin_type enum
-- Required by client doc section 3.7

ALTER TYPE pin_type ADD VALUE IF NOT EXISTS 'pickpocket';
ALTER TYPE pin_type ADD VALUE IF NOT EXISTS 'recommendation';
