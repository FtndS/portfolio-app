#!/usr/bin/env bash
# Install daily DB backup cron job on VPS (3:00 AM server time).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_SCRIPT="$ROOT/scripts/backup-db.sh"
CRON_LINE="0 3 * * * $BACKUP_SCRIPT daily >> /var/log/portfolio-backup.log 2>&1"

chmod +x "$BACKUP_SCRIPT"

if crontab -l 2>/dev/null | grep -Fq "$BACKUP_SCRIPT"; then
  echo "Cron job already installed."
  exit 0
fi

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
echo "Installed daily backup cron:"
echo "  $CRON_LINE"
echo "Logs: /var/log/portfolio-backup.log"
