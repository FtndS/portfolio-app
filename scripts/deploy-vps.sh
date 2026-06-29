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

docker compose up -d postgres

echo "==> Remove stale container refs (fixes 'No such container' on recreate)"
docker compose rm -sf backend frontend nginx 2>/dev/null || true
docker rm -f portfolio-backend portfolio-frontend portfolio-nginx 2>/dev/null || true
while IFS= read -r name; do
  [ -n "$name" ] && docker rm -f "$name" 2>/dev/null || true
done < <(docker ps -a --format '{{.Names}}' 2>/dev/null | grep -E '_portfolio-(backend|frontend|nginx)$' || true)

docker compose up -d --force-recreate --remove-orphans backend

health_ok() {
  docker compose exec -T backend node -e "
    fetch('http://127.0.0.1:3001/api/health')
      .then((r) => r.json())
      .then((d) => process.exit(d.status === 'ok' ? 0 : 1))
      .catch(() => process.exit(1))
  " 2>/dev/null
}

echo "==> Wait for backend"
for i in $(seq 1 30); do
  if health_ok; then
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

docker compose up -d --force-recreate --remove-orphans frontend nginx

docker compose ps
health_ok && docker compose exec -T backend node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>r.text()).then(t=>console.log(t))"
echo ""
echo "Deploy complete."
