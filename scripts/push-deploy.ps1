# Commit, push to main, and trigger GitHub Actions auto-deploy on VPS.
# Usage:
#   .\scripts\push-deploy.ps1
#   .\scripts\push-deploy.ps1 "fix: theme colors in modals"
param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
    Write-Host "WARN: current branch is '$branch' (auto-deploy runs on push to main only)" -ForegroundColor Yellow
}

$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit — working tree clean." -ForegroundColor Yellow
    Write-Host "Push anyway? GitHub Actions deploys on every push to main."
    $confirm = Read-Host "git push origin $branch? [y/N]"
    if ($confirm -notmatch '^[yY]') { exit 0 }
    git push origin $branch
    Write-Host ""
    Write-Host "Pushed. Watch deploy: https://github.com/FtndS/portfolio-app/actions/workflows/deploy.yml" -ForegroundColor Green
    exit 0
}

if (-not $Message) {
    $Message = Read-Host "Commit message"
    if (-not $Message.Trim()) {
        Write-Host "Aborted — commit message required." -ForegroundColor Red
        exit 1
    }
}

git add -A
git status --short
git commit -m $Message
git push origin $branch

Write-Host ""
Write-Host "Done — VPS will pull and rebuild automatically (GitHub Actions)." -ForegroundColor Green
Write-Host "Actions: https://github.com/FtndS/portfolio-app/actions/workflows/deploy.yml"
