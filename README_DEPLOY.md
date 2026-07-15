# Deployment Guide — AWS EC2

## Prerequisites

- Ubuntu 22.04 EC2 instance (t3.medium recommended)
- Security group: 22, 80, 443 open
- A domain name pointing to the EC2 public IP

## Steps

1. **Copy code to server**
   ```bash
   rsync -avz --exclude='node_modules' --exclude='.next' --exclude='__pycache__' ./ ubuntu@your-ec2-ip:/opt/aiep/
   ```

2. **Upload `.env`**
   ```bash
   scp .env.production ubuntu@your-ec2-ip:/opt/aiep/.env
   ```

3. **Run deploy script**
   ```bash
   ./deploy.sh ubuntu@your-ec2-ip yourdomain.com
   ```

4. **First-time SSL**
   If certbot fails inside the script, run manually:
   ```bash
   ssh ubuntu@your-ec2-ip
   cd /opt/aiep
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   docker run -it --rm -v certbot-data:/etc/letsencrypt -v certbot-www:/var/www/certbot certbot/certbot certonly --webroot -w /var/www/certbot -d yourdomain.com --agree-tos --no-eff-email -m your-email@example.com
   sed -i 's/YOUR_DOMAIN/yourdomain.com/g' nginx/nginx.prod.conf
   docker exec aiep_nginx nginx -s reload
   ```

5. **Post-deploy setup**
   - Initialize DB: `docker exec aiep_backend python init_db.py`
   - Ingest products: `docker exec aiep_backend python -m ingestion.ingest`
   - Start bot: already handled by lifespan in main.py

6. **Dry run**
   - Open `https://yourdomain.com`
   - Click "Trigger Demo Task"
   - Verify Telegram approval arrives
   - Approve → verify email sent → task shows completed

## Updating

```bash
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='__pycache__' ./ ubuntu@your-ec2-ip:/opt/aiep/
ssh ubuntu@your-ec2-ip "cd /opt/aiep && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
```
