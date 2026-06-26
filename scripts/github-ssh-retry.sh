#!/usr/bin/env bash
# Retry TCP + SSH for GitHub Actions runners → VPS (intermittent routing/timeouts).
set -euo pipefail

VPS_HOST="${VPS_HOST:?VPS_HOST is required}"
VPS_USER="${VPS_USER:?VPS_USER is required}"
VPS_PORT="${VPS_PORT:-22}"
SSH_RETRIES="${SSH_RETRIES:-4}"
TCP_TIMEOUT="${TCP_TIMEOUT:-45}"
SSH_CONNECT_TIMEOUT="${SSH_CONNECT_TIMEOUT:-45}"
RETRY_DELAY="${RETRY_DELAY:-12}"

TARGET="${VPS_USER}@${VPS_HOST}"
SSH_OPTS=(
  -p "$VPS_PORT"
  -o BatchMode=yes
  -o "ConnectTimeout=${SSH_CONNECT_TIMEOUT}"
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=10
  -o StrictHostKeyChecking=accept-new
)

wait_tcp() {
  timeout "$TCP_TIMEOUT" bash -c "cat < /dev/null > /dev/tcp/${VPS_HOST}/${VPS_PORT}" 2>/dev/null
}

with_ssh_retry() {
  local attempt
  for attempt in $(seq 1 "$SSH_RETRIES"); do
    echo "==> Attempt ${attempt}/${SSH_RETRIES} → ${TARGET}:${VPS_PORT}"
    if wait_tcp; then
      echo "TCP port open — running SSH..."
      if ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; then
        return 0
      fi
      echo "::warning::SSH failed on attempt ${attempt}"
    else
      echo "::warning::TCP timeout (${TCP_TIMEOUT}s) on attempt ${attempt}"
    fi
    if [ "$attempt" -lt "$SSH_RETRIES" ]; then
      echo "Waiting ${RETRY_DELAY}s before retry..."
      sleep "$RETRY_DELAY"
    fi
  done
  return 1
}

mode="${1:-test}"
shift || true

case "$mode" in
  test)
    with_ssh_retry 'echo "SSH OK — connected as $(whoami) on $(hostname)"' || {
      echo "::error title=SSH unreachable after ${SSH_RETRIES} retries::Could not reach ${VPS_HOST}:${VPS_PORT} within ${TCP_TIMEOUT}s per attempt. Manual deploy: ssh ${TARGET}"
      exit 255
    }
    ;;
  deploy)
    with_ssh_retry bash -s <<'REMOTE'
set -euo pipefail
if [ ! -d ~/portfolio-app/.git ]; then
  echo "ERROR: ~/portfolio-app is missing or not a git repo"
  exit 1
fi
cd ~/portfolio-app
chmod +x scripts/deploy-vps.sh 2>/dev/null || true
bash scripts/deploy-vps.sh
REMOTE
    ;;
  verify)
    with_ssh_retry bash -s <<'REMOTE'
set -e
echo "SSH OK — connected as $(whoami) on $(hostname)"
echo "Docker: $(docker --version 2>/dev/null || echo not installed)"
if [ -d ~/portfolio-app ]; then
  cd ~/portfolio-app
  echo "Repo: $(git rev-parse --short HEAD 2>/dev/null || echo unknown) on $(git branch --show-current 2>/dev/null || echo unknown)"
  docker compose ps 2>/dev/null || true
  if [ -f .env ]; then echo ".env: present"; else echo "WARN: .env not found"; fi
else
  echo "WARN: ~/portfolio-app not found"
fi
echo "Verify complete."
REMOTE
    ;;
  *)
    echo "Usage: $0 {test|deploy|verify}"
    exit 2
    ;;
esac
