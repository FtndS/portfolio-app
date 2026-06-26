#!/usr/bin/env bash
# Wipe all PostgreSQL data and re-run migrations on next backend start.
# Usage: ./scripts/reset-db.sh [-y|--yes]
# WARNING: irreversible — deletes every user, portfolio, and transaction.

set -euo pipefail

AUTO_YES=false
for arg in "$@"; do
  case "$arg" in
    -y|--yes) AUTO_YES=true ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found on this machine."
  echo "Run this script on the VPS where docker compose is installed:"
  echo "  ssh root@YOUR_VPS_IP 'cd ~/portfolio-app && ./scripts/reset-db.sh -y'"
  exit 1
fi

# shellcheck disable=SC1091
source "$(dirname "$0")/lib/read-env.sh"
DB_USER="$(read_env_var DB_USER ftnds)"
DB_NAME="$(read_env_var DB_NAME portfolio_db)"

echo "This will DELETE ALL DATA in database: $DB_NAME"
if [ "$AUTO_YES" != true ]; then
  read -r -p "Type yes to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" <<SQL
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL ON SCHEMA public TO public;
SQL

echo "Database wiped. Restarting backend to apply migrations..."
docker compose restart backend

echo "Done. Only OTP-verified registrations are allowed after this reset."
