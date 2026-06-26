#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pull latest code"
git fetch origin main
git reset --hard origin/main
echo "Deployed commit: $(git rev-parse --short HEAD)"

if [ ! -f .env ]; then
  echo "ERROR: .env not found — create it first"
  exit 1
fi

chmod +x scripts/backup-db.sh scripts/restore-db.sh scripts/setup-backup-cron.sh scripts/generate-jwt-secret.sh 2>/dev/null || true

echo "==> Backup database before deploy"
if [ -x scripts/backup-db.sh ]; then
  ./scripts/backup-db.sh pre-deploy || echo "WARN: backup failed — deploy continues"
fi

echo "==> Build & restart containers"
docker compose build --no-cache frontend
docker compose build backend
docker compose up -d --force-recreate
docker compose restart nginx

echo "==> Wait for backend"
for i in $(seq 1 30); do
  if curl -sfL http://localhost/api/health 2>/dev/null | grep -q '"status":"ok"'; then
    echo "Backend healthy"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Backend failed to start"
    docker compose ps
    docker compose logs backend --tail 80
    exit 1
  fi
  sleep 2
done

docker compose ps
curl -sfL http://localhost/api/health
echo ""
echo "Deploy complete."
