#!/usr/bin/env bash
# SafeTag Database Backup Script
#
# Usage:
#   ./scripts/backup-db.sh               # Uses .env for connection details
#   BACKUP_DIR=/path ./scripts/backup-db.sh  # Custom backup directory
#
# Environment variables (from .env or exported):
#   DATABASE_URL  — PostgreSQL connection string
#   BACKUP_DIR    — Directory to store backups (default: ./backups)
#   BACKUP_RETAIN — Number of daily backups to keep (default: 7)
#
# Recommended cron (daily at 03:00 UTC):
#   0 3 * * * cd /path/to/safetag && ./scripts/backup-db.sh >> /var/log/safetag-backup.log 2>&1

set -euo pipefail

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETAIN="${BACKUP_RETAIN:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/safetag_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set. Cannot create backup."
  exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting database backup..."

# Create compressed backup
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --verbose 2>/dev/null \
  | gzip > "$BACKUP_FILE"

FILESIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup created: $BACKUP_FILE ($FILESIZE)"

# Cleanup old backups (keep last N)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/safetag_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$BACKUP_RETAIN" ]; then
  DELETE_COUNT=$((BACKUP_COUNT - BACKUP_RETAIN))
  ls -1t "$BACKUP_DIR"/safetag_*.sql.gz | tail -n "$DELETE_COUNT" | xargs rm -f
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Cleaned up $DELETE_COUNT old backup(s). Retaining last $BACKUP_RETAIN."
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete."
