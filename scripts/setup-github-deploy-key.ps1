# Generate deploy key for GitHub Actions (run in PowerShell on your PC)
$KeyPath = if ($args[0]) { $args[0] } else { "$env:USERPROFILE\.ssh\portfolio-app-deploy" }
$KeyDir = Split-Path $KeyPath

if (-not (Test-Path $KeyDir)) {
  New-Item -ItemType Directory -Force -Path $KeyDir | Out-Null
}

if (Test-Path $KeyPath) {
  Write-Host "Key already exists: $KeyPath"
} else {
  ssh-keygen -t ed25519 -C "github-actions-portfolio-app" -f $KeyPath -N '""'
  Write-Host "Created: $KeyPath"
}

$Pub = (Get-Content "$KeyPath.pub" -Raw).Trim()

Write-Host ""
Write-Host "=========================================="
Write-Host " Step 1 - Add public key on VPS"
Write-Host "=========================================="
Write-Host $Pub
Write-Host ""
Write-Host "On VPS run these commands one by one:"
Write-Host '  mkdir -p ~/.ssh'
Write-Host '  chmod 700 ~/.ssh'
Write-Host ('  echo ' + [char]39 + $Pub + [char]39 + ' >> ~/.ssh/authorized_keys')
Write-Host '  chmod 600 ~/.ssh/authorized_keys'
Write-Host ""
Write-Host "Test from this PC:"
Write-Host ('  ssh -i ' + $KeyPath + ' root@187.127.106.246 "echo OK"')
Write-Host ""
Write-Host "=========================================="
Write-Host " Step 2 - GitHub Repository Secrets"
Write-Host "=========================================="
Write-Host "https://github.com/FtndS/portfolio-app/settings/secrets/actions"
Write-Host ""
Write-Host "  VPS_HOST     = 187.127.106.246"
Write-Host "  VPS_USER     = root"
Write-Host "  VPS_PORT     = 22  (optional)"
Write-Host "  VPS_SSH_KEY  = paste private key below (WITH BEGIN/END lines)"
Write-Host ""
Write-Host "----- PRIVATE KEY -----"
Get-Content $KeyPath
Write-Host "----- END PRIVATE KEY -----"
