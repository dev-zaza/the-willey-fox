-- 0021_safety_mode.sql
-- Women & Vulnerable People Safety: add pin categories + safety mode preference

-- Add new pin types for vulnerability-focused reporting
ALTER TYPE pin_type ADD VALUE IF NOT EXISTS 'harassment';
ALTER TYPE pin_type ADD VALUE IF NOT EXISTS 'unsafe_area';

-- Add safety_mode preference to users (weights assault/harassment higher in routing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS safety_mode BOOLEAN NOT NULL DEFAULT false;
