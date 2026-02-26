#!/usr/bin/env bash
# FounderOS — Web Frontend Redeploy Script
#
# Builds the Expo web export locally and deploys to the droplet.
#
# Usage (from repo root):
#   bash deploy/redeploy-web.sh
#
set -euo pipefail

DROPLET_IP="${DROPLET_IP:-138.197.23.33}"
DROPLET_USER="${DROPLET_USER:-root}"
MOBILE_DIR="apps/mobile"

echo "==> Building FounderOS web frontend"
cd "$MOBILE_DIR"

EXPO_PUBLIC_API_URL="http://${DROPLET_IP}" \
EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://xwqcnmmdodiireigtjkb.supabase.co}" \
EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-sb_publishable_Op5QsFjEFZoEs2YghBdu5Q_77HMFKIa}" \
  npx expo export --platform web

echo "==> Packaging build"
tar czf /tmp/founderos-web.tar.gz -C dist .

echo "==> Uploading to droplet"
scp /tmp/founderos-web.tar.gz "${DROPLET_USER}@${DROPLET_IP}:/tmp/founderos-web.tar.gz"

echo "==> Deploying on droplet"
ssh "${DROPLET_USER}@${DROPLET_IP}" 'bash -s' << 'REMOTE'
rm -rf /var/www/founderos-web/*
tar xzf /tmp/founderos-web.tar.gz -C /var/www/founderos-web
rm /tmp/founderos-web.tar.gz
echo "Deployed $(du -sh /var/www/founderos-web/ | cut -f1) to /var/www/founderos-web/"
REMOTE

rm /tmp/founderos-web.tar.gz
echo "✅ Web frontend deployed to http://${DROPLET_IP}"

