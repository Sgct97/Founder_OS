#!/usr/bin/env bash
# FounderOS — DigitalOcean Droplet Bootstrap
#
# Run once on a fresh Ubuntu 24.04 Droplet to install all dependencies
# and prepare the server for deployment.
#
# Usage (as root):
#   scp deploy/setup-droplet.sh root@<droplet-ip>:/tmp/
#   ssh root@<droplet-ip> bash /tmp/setup-droplet.sh
#
# After this script completes, follow the printed "Next steps".

set -euo pipefail

DOMAIN="${DOMAIN:-api.founderos.app}"
DEPLOY_USER="deploy"
APP_DIR="/home/$DEPLOY_USER/founder-os"
API_DIR="$APP_DIR/apps/api"

echo "══════════════════════════════════════════════"
echo "  FounderOS Droplet Setup"
echo "  Domain: $DOMAIN"
echo "══════════════════════════════════════════════"
echo ""

# ── 1. System packages ───────────────────────────────────────────
echo "==> [1/8] Installing system packages..."
apt-get update -qq
apt-get install -y -qq \
  build-essential \
  curl \
  git \
  gnupg2 \
  lsb-release \
  nginx \
  certbot \
  python3-certbot-nginx \
  python3-pip \
  python3-venv \
  pipx \
  software-properties-common \
  ufw \
  libpq-dev \
  poppler-utils \
  tesseract-ocr \
  libreoffice-core

# ── 2. Python 3.13 (deadsnakes PPA) ──────────────────────────────
echo "==> [2/8] Installing Python 3.13..."
if ! python3.13 --version &>/dev/null; then
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get update -qq
  apt-get install -y -qq python3.13 python3.13-venv python3.13-dev
fi
echo "    Python: $(python3.13 --version)"

# ── 3. PostgreSQL 16 + pgvector ──────────────────────────────────
echo "==> [3/8] Installing PostgreSQL 16 + pgvector..."
if ! dpkg -l | grep -q postgresql-16; then
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update -qq
  apt-get install -y -qq postgresql-16 postgresql-16-pgvector
fi

# Create database, user, and enable pgvector
echo "==> Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE USER founderos WITH PASSWORD 'CHANGE_ME_IMMEDIATELY';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE founder_os OWNER founderos;" 2>/dev/null || true
sudo -u postgres psql -d founder_os -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE founder_os TO founderos;"

# ── 4. Deploy user ───────────────────────────────────────────────
echo "==> [4/8] Creating deploy user..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi

# ── 5. Poetry (installed as deploy user) ─────────────────────────
echo "==> [5/8] Installing Poetry for $DEPLOY_USER..."
sudo -u "$DEPLOY_USER" bash -c 'pipx install poetry 2>/dev/null || true'
sudo -u "$DEPLOY_USER" bash -c 'pipx ensurepath 2>/dev/null || true'

# ── 6. Firewall ──────────────────────────────────────────────────
echo "==> [6/8] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 7. Nginx config ──────────────────────────────────────────────
echo "==> [7/8] Configuring Nginx..."
if [ -f "$APP_DIR/deploy/nginx-founderos.conf" ]; then
  cp "$APP_DIR/deploy/nginx-founderos.conf" /etc/nginx/sites-available/founderos
  ln -sf /etc/nginx/sites-available/founderos /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  echo "    Nginx configured ✓"
else
  echo "    ⚠ Nginx config not found — will configure after repo clone"
fi

# ── 8. Systemd service ──────────────────────────────────────────
echo "==> [8/8] Installing systemd service..."
if [ -f "$APP_DIR/deploy/founderos-api.service" ]; then
  cp "$APP_DIR/deploy/founderos-api.service" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable founderos-api
  echo "    Systemd service installed ✓"
else
  echo "    ⚠ Service file not found — will install after repo clone"
fi

# ── Done ─────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ System setup complete!"
echo "══════════════════════════════════════════════"
echo ""
echo "Next steps (run these in order):"
echo ""
echo "  1. Clone the repo:"
echo "     sudo -u $DEPLOY_USER git clone <your-repo-url> $APP_DIR"
echo ""
echo "  2. Create the .env file:"
echo "     sudo -u $DEPLOY_USER cp $API_DIR/.env.production.example $API_DIR/.env"
echo "     sudo -u $DEPLOY_USER nano $API_DIR/.env"
echo "     # Fill in: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, etc."
echo ""
echo "  3. Install Python deps:"
echo "     sudo -u $DEPLOY_USER bash -c 'cd $API_DIR && ~/.local/bin/poetry install --no-dev'"
echo ""
echo "  4. Run database migrations:"
echo "     sudo -u $DEPLOY_USER bash -c 'cd $API_DIR && ~/.local/bin/poetry run alembic upgrade head'"
echo ""
echo "  5. Install Nginx + systemd configs:"
echo "     cp $APP_DIR/deploy/nginx-founderos.conf /etc/nginx/sites-available/founderos"
echo "     ln -sf /etc/nginx/sites-available/founderos /etc/nginx/sites-enabled/"
echo "     rm -f /etc/nginx/sites-enabled/default"
echo "     nginx -t && systemctl reload nginx"
echo ""
echo "     cp $APP_DIR/deploy/founderos-api.service /etc/systemd/system/"
echo "     systemctl daemon-reload && systemctl enable founderos-api"
echo ""
echo "  6. Start the API:"
echo "     systemctl start founderos-api"
echo "     journalctl -u founderos-api -f   # watch logs"
echo ""
echo "  7. Test it:"
echo "     curl http://$DOMAIN/api/health"
echo ""
echo "  8. Get SSL cert (after DNS A record points here):"
echo "     certbot --nginx -d $DOMAIN"
echo ""
echo "  ⚠ IMPORTANT: Change the PostgreSQL password!"
echo "     sudo -u postgres psql -c \"ALTER USER founderos PASSWORD 'your-strong-password';\""
echo "     Then update DATABASE_URL in .env to match."
echo ""
