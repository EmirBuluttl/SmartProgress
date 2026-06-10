#!/bin/bash
# SmartProgress - Otomatik PostgreSQL Backup Script
# Her gece çalışır, 30 günlük backup saklar

BACKUP_DIR="/home/ubuntu/smartprogress/backups"
TIMESTAMP=$(date +"%Y%m%d-%H%M")
BACKUP_FILE="$BACKUP_DIR/smartprogress-$TIMESTAMP.sql.gz"
CONTAINER="smartprogress-postgres"
DB_USER="smartadmin"
DB_NAME="smartprogress"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Backup başlıyor: $BACKUP_FILE"

docker exec "$CONTAINER" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  echo "[$(date)] Backup başarılı: $(du -sh $BACKUP_FILE | cut -f1)"
else
  echo "[$(date)] HATA: Backup başarısız!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# 30 günden eski backup'ları sil
find "$BACKUP_DIR" -name "smartprogress-*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Eski backup'lar temizlendi."

echo "[$(date)] Mevcut backup'lar:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "Backup yok"
