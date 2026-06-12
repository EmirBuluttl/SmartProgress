#!/usr/bin/env bash
# SmartProgress PostgreSQL backup script.
# Intended cron: 0 2 * * * /home/ubuntu/smartprogress/backups/backup.sh >> /home/ubuntu/smartprogress/backups/backup.log 2>&1

set -Eeuo pipefail

BACKUP_DIR="/home/ubuntu/smartprogress/backups"
TIMESTAMP="$(date +"%Y%m%d-%H%M")"
CONTAINER="smartprogress-postgres"
DB_USER="smartadmin"
DB_NAME="smartprogress"
KEEP_DAYS=30

SQL_GZ_FILE="$BACKUP_DIR/smartprogress-$TIMESTAMP.sql.gz"
DUMP_FILE="$BACKUP_DIR/smartprogress-$TIMESTAMP.dump"
SCHEMA_FILE="$BACKUP_DIR/schema-only-$TIMESTAMP.sql"

log() {
  echo "[$(date)] $*"
}

assert_nonempty_file() {
  local file="$1"

  if [ ! -s "$file" ]; then
    log "ERROR: Backup file is missing or empty: $file"
    rm -f "$file"
    exit 1
  fi
}

mkdir -p "$BACKUP_DIR"

log "Backup starting: $TIMESTAMP"

log "Creating compressed SQL backup: $SQL_GZ_FILE"
docker exec "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  | gzip > "$SQL_GZ_FILE"
assert_nonempty_file "$SQL_GZ_FILE"

log "Creating custom dump backup: $DUMP_FILE"
docker exec "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner --no-acl \
  > "$DUMP_FILE"
assert_nonempty_file "$DUMP_FILE"

log "Creating schema-only backup: $SCHEMA_FILE"
docker exec "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --schema-only --no-owner --no-acl \
  > "$SCHEMA_FILE"
assert_nonempty_file "$SCHEMA_FILE"

log "Backup completed successfully"
du -sh "$SQL_GZ_FILE" "$DUMP_FILE" "$SCHEMA_FILE"

log "Removing backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -name "smartprogress-*.sql.gz" -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name "smartprogress-*.dump" -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name "schema-only-*.sql" -mtime +"$KEEP_DAYS" -delete

log "Current backup files"
ls -lh "$BACKUP_DIR"/smartprogress-*.sql.gz "$BACKUP_DIR"/smartprogress-*.dump "$BACKUP_DIR"/schema-only-*.sql 2>/dev/null || log "No backup files found"
