#!/usr/bin/env bash
# Restore PostgreSQL from a .sql.gz backup.
# Usage: ./scripts/restore-db.sh /path/to/backup.sql.gz
# WARNING: overwrites current database contents.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 /path/to/backup.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: file not found: $BACKUP_FILE"
  exit 1
fi

# shellcheck disable=SC1091
source "$(dirname "$0")/lib/read-env.sh"
DB_USER="$(read_env_var DB_USER ftnds)"
DB_NAME="$(read_env_var DB_NAME portfolio_db)"

echo "This will REPLACE all data in database: $DB_NAME"
read -r -p "Type yes to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"
echo "Restore complete."
