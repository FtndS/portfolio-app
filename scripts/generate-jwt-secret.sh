#!/usr/bin/env bash
# Generate a secure JWT_SECRET for .env

set -euo pipefail

SECRET="$(openssl rand -hex 32)"

echo "Add this line to ~/portfolio-app/.env on VPS:"
echo ""
echo "JWT_SECRET=$SECRET"
echo ""
echo "Then run:"
echo "  cd ~/portfolio-app && docker compose up -d backend"
echo ""
echo "Note: all users must log in again after JWT_SECRET changes."
