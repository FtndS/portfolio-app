# Wipe all PostgreSQL data and re-run migrations on next backend start.
# Usage: .\scripts\reset-db.ps1
# WARNING: irreversible — deletes every user, portfolio, and transaction.
#
# Requires Docker (run on VPS). On Windows without Docker, use:
#   .\scripts\reset-db-remote.ps1 -VpsHost YOUR_VPS_IP

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host 'Docker not found on this PC.' -ForegroundColor Yellow
  Write-Host 'Port Diary Postgres runs in Docker on the VPS, not on Windows.'
  Write-Host ''
  Write-Host 'Option 1 — from Windows via SSH:'
  Write-Host '  .\scripts\reset-db-remote.ps1 -VpsHost YOUR_VPS_IP'
  Write-Host ''
  Write-Host 'Option 2 — SSH into VPS and run:'
  Write-Host '  ssh root@YOUR_VPS_IP'
  Write-Host '  cd ~/portfolio-app && ./scripts/reset-db.sh'
  Write-Host ''
  exit 1
}

function Read-EnvVar($key, $default) {
  $envFile = Join-Path $Root '.env'
  if (-not (Test-Path $envFile)) { return $default }
  $line = Get-Content $envFile | Where-Object { $_ -match "^$key=" } | Select-Object -Last 1
  if (-not $line) { return $default }
  $val = $line.Substring($line.IndexOf('=') + 1).Trim().Trim('"').Trim("'")
  if ([string]::IsNullOrWhiteSpace($val)) { return $default }
  return $val
}

$dbUser = Read-EnvVar 'DB_USER' 'ftnds'
$dbName = Read-EnvVar 'DB_NAME' 'portfolio_db'

Write-Host "This will DELETE ALL DATA in database: $dbName"
$confirm = Read-Host 'Type yes to continue'
if ($confirm -ne 'yes') {
  Write-Host 'Aborted.'
  exit 1
}

$sql = @"
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO $dbUser;
GRANT ALL ON SCHEMA public TO public;
"@

$sql | docker compose exec -T postgres psql -U $dbUser -d $dbName

Write-Host 'Database wiped. Restarting backend to apply migrations...'
docker compose restart backend

Write-Host 'Done. Only OTP-verified registrations are allowed after this reset.'
