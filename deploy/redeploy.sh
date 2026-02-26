#!/usr/bin/env bash
# FounderOS — Quick Redeploy
#
# Run as the deploy user after pushing new code:
#   ssh deploy@<droplet-ip> bash ~/founder-os/deploy/redeploy.sh
#
# What it does:
#   1. Pulls latest code from main
#   2. Installs any new Python dependencies
#   3. Runs database migrations
#   4. Restarts the API service

set -euo pipefail

APP_DIR="/home/deploy/founder-os"
API_DIR="$APP_DIR/apps/api"

echo "==> Pulling latest code..."
cd "$APP_DIR"
git pull origin main

echo "==> Installing dependencies..."
cd "$API_DIR"
~/.local/bin/poetry install --no-dev

echo "==> Running database migrations..."
~/.local/bin/poetry run alembic upgrade head

echo "==> Restarting API service..."
sudo systemctl restart founderos-api

echo "==> Waiting for startup..."
sleep 3

# Health check
if curl -sf http://localhost:8000/api/health > /dev/null; then
  echo "✅ Deploy complete — API is healthy"
else
  echo "❌ API health check failed — check logs:"
  echo "   journalctl -u founderos-api -n 50 --no-pager"
  exit 1
fi

