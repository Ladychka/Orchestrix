#!/bin/bash
set -e

# AI Employee Platform — EC2 Deploy Script
# Usage: ./deploy.sh user@host YOUR_DOMAIN

HOST="$1"
DOMAIN="$2"

if [[ -z "$HOST" || -z "$DOMAIN" ]]; then
  echo "Usage: ./deploy.sh user@host YOUR_DOMAIN"
  exit 1
fi

echo "Deploying to $HOST for domain $DOMAIN ..."

# 1. Copy source
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='__pycache__' \
  ./ $HOST:/opt/aiep/

# 2. SSH in and bring up stack
ssh $HOST <<EOF
  cd /opt/aiep

  # Install Docker & Compose if missing
  if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker \$USER
  fi

  # Seed .env on remote (assumes you scp it beforehand or keep it on server)
  if [[ ! -f .env ]]; then
    echo "WARNING: .env not found on remote. Copy it manually before running."
    exit 1
  fi

  # Build & start production stack
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

  # Initialize database
  docker exec aiep_backend python init_db.py

  # Seed Qdrant knowledge base
  docker exec aiep_backend python -m ingestion.ingest || echo "Ingestion may require running from host with Qdrant up"

  # Issue Let's Encrypt cert (first time)
  docker run -it --rm \
    -v /opt/aiep/certbot-data:/etc/letsencrypt \
    -v /opt/aiep/certbot-www:/var/www/certbot \
    certbot/certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --agree-tos --no-eff-email -m your-email@example.com

  # Replace YOUR_DOMAIN in nginx config
  sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx/nginx.prod.conf

  # Reload nginx
  docker exec aiep_nginx nginx -s reload || docker compose restart nginx
EOF

echo "Deployment complete."
