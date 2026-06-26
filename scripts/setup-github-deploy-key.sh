#!/usr/bin/env bash
# Generate a dedicated deploy key for GitHub Actions → VPS SSH.
# Run on your LOCAL machine (not on VPS).
set -euo pipefail

KEY_PATH="${1:-$HOME/.ssh/portfolio-app-deploy}"

if [ -f "$KEY_PATH" ]; then
  echo "Key already exists: $KEY_PATH"
  echo "Delete it first if you want a new key: rm $KEY_PATH $KEY_PATH.pub"
else
  ssh-keygen -t ed25519 -C "github-actions-portfolio-app" -f "$KEY_PATH" -N ""
  echo "Created new key pair at $KEY_PATH"
fi

PUB=$(cat "${KEY_PATH}.pub")

echo ""
echo "=========================================="
echo " Step 1 — Add public key on VPS"
echo "=========================================="
echo "SSH into VPS, then run:"
echo ""
echo "  mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "  echo '$PUB' >> ~/.ssh/authorized_keys"
echo "  chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "Test from your machine:"
echo "  ssh -i $KEY_PATH root@YOUR_VPS_IP 'echo OK'"
echo ""
echo "=========================================="
echo " Step 2 — GitHub Secrets"
echo "=========================================="
echo "Repo → Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo "  VPS_HOST     = your VPS IP (e.g. 187.127.106.246)"
echo "  VPS_USER     = root"
echo "  VPS_PORT     = 22   (optional)"
echo "  VPS_SSH_KEY  = paste ENTIRE private key below (include BEGIN/END lines)"
echo ""
echo "----- PRIVATE KEY (VPS_SSH_KEY) -----"
cat "$KEY_PATH"
echo "----- END PRIVATE KEY -----"
echo ""
echo "=========================================="
echo " Step 3 — Verify"
echo "=========================================="
echo "GitHub → Actions → Verify VPS SSH → Run workflow"
echo "Then push to main or run Deploy to VPS manually."
