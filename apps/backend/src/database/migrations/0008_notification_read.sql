-- Migration 0008: add last_notification_read_at to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notification_read_at TIMESTAMP;
