#!/usr/bin/env bash
# Backup PostgreSQL from Docker Compose stack.
# Usage: ./scripts/backup-db.sh [label]
# Example cron (daily 3am): 0 3 * * * /root/portfolio-app/scripts/backup-db.sh daily >> /var/log/portfolio-backup.log 2>&1

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LABEL="${1:-manual}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/portfolio-app}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DB_USER="${DB_USER:-ftnds}"
DB_NAME="${DB_NAME:-portfolio_db}"

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/${DB_NAME}_${LABEL}_$(date +%Y%m%d_%H%M%S).sql.gz"

if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "ERROR: postgres container is not running"
  exit 1
fi

docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup saved: $FILE ($(du -h "$FILE" | cut -f1))"
