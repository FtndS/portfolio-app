# Wipe PostgreSQL on the VPS via SSH (for Windows without local Docker).
# Usage:
#   .\scripts\reset-db-remote.ps1 -VpsHost YOUR_VPS_IP
#   .\scripts\reset-db-remote.ps1 -VpsHost YOUR_VPS_IP -SshKey "$env:USERPROFILE\.ssh\portfolio-app-deploy"
#
# WARNING: irreversible — deletes every user, portfolio, and transaction.

param(
  [Parameter(Mandatory = $true)]
  [string]$VpsHost,
  [string]$VpsUser = 'root',
  [int]$VpsPort = 22,
  [string]$SshKey = '',
  [string]$RemotePath = '~/portfolio-app'
)

$ErrorActionPreference = 'Stop'

Write-Host "This will DELETE ALL DATA in database on VPS: $VpsHost"
$confirm = Read-Host 'Type yes to continue'
if ($confirm -ne 'yes') {
  Write-Host 'Aborted.'
  exit 1
}

$sshArgs = @('-p', $VpsPort, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new')
if ($SshKey) {
  $sshArgs += @('-i', $SshKey)
}
$sshArgs += "${VpsUser}@${VpsHost}"

$remoteCmd = "cd $RemotePath && chmod +x scripts/reset-db.sh && ./scripts/reset-db.sh -y"
Write-Host "Running on VPS: $remoteCmd"

& ssh @sshArgs $remoteCmd
if ($LASTEXITCODE -ne 0) {
  Write-Error "Remote reset failed (exit $LASTEXITCODE)."
}

Write-Host 'Done. Only OTP-verified registrations are allowed after this reset.'
