# Deployment Guide

This guide covers deploying MixModel to production using Docker Compose on a single server.

---

## Prerequisites

### System Requirements

- **Server:** Linux (Ubuntu 22.04+ recommended) with 8GB+ RAM, 4+ CPU cores
- **Docker:** Docker Engine 20.10+ and Docker Compose v2
- **Domain:** Configured DNS A record pointing to your server IP
- **SSL Certificate:** Let's Encrypt or other TLS certificate for HTTPS

### Install Docker

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

## Environment Variables

### Required Configuration

Copy `.env.example` to `.env` and configure all variables:

```bash
cp .env.example .env
nano .env
```

### Environment Variables Reference

#### Database Configuration
```bash
# PostgreSQL connection strings
DATABASE_URL=postgresql+asyncpg://mixmodel:YOUR_SECURE_PASSWORD@postgres:5432/mixmodel
DATABASE_URL_SYNC=postgresql://mixmodel:YOUR_SECURE_PASSWORD@postgres:5432/mixmodel

# Database credentials
POSTGRES_USER=mixmodel
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD  # CHANGE THIS
POSTGRES_DB=mixmodel
```

#### Redis Configuration
```bash
# Redis for caching, pub/sub, and Celery
REDIS_URL=redis://redis:6379/0        # General cache + SSE pub/sub
CELERY_BROKER_URL=redis://redis:6379/1   # Celery task broker
CELERY_RESULT_BACKEND=redis://redis:6379/2  # Celery result storage
```

#### JWT Configuration
```bash
# Generate secure secret: openssl rand -hex 32
JWT_SECRET_KEY=YOUR_SECURE_RANDOM_STRING  # CHANGE THIS (critical)
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

#### S3/MinIO Configuration
```bash
# For production with AWS S3
S3_ENDPOINT_URL=  # Leave empty for AWS S3, or set for MinIO
S3_ACCESS_KEY=YOUR_AWS_ACCESS_KEY
S3_SECRET_KEY=YOUR_AWS_SECRET_KEY
S3_BUCKET_NAME=mixmodel-uploads-prod
S3_REGION=us-east-1

# For self-hosted MinIO (included in docker-compose.yml)
S3_ENDPOINT_URL=http://minio:9000
S3_ACCESS_KEY=minioadmin  # CHANGE THIS
S3_SECRET_KEY=minioadmin  # CHANGE THIS
S3_BUCKET_NAME=mixmodel-uploads
S3_REGION=us-east-1
```

#### Application Configuration
```bash
# Environment mode
APP_ENV=production  # production | development | test
APP_DEBUG=false

# CORS origins (comma-separated)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# API prefix (default: /api)
API_PREFIX=/api
```

#### Observability Configuration
```bash
# Sentry for error tracking (optional but recommended)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_DSN=https://your-frontend-sentry-dsn@sentry.io/project-id
```

#### Celery Monitoring (Flower)
```bash
# Flower web UI credentials
FLOWER_USER=admin
FLOWER_PASSWORD=YOUR_SECURE_PASSWORD  # CHANGE THIS
```

---

## Docker Compose Deployment

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/mixmodel.git
cd mixmodel
```

### Step 2: Configure Environment

```bash
cp .env.example .env
nano .env  # Edit as described above
```

### Step 3: Build and Start Services

```bash
# Build all images
docker compose build

# Start all services in detached mode
docker compose up -d

# Verify all containers are running
docker compose ps
```

**Expected containers:**
- `mixmodel-api-1` (FastAPI backend)
- `mixmodel-frontend-1` (Nginx + React SPA)
- `mixmodel-celery-worker-1` (Celery worker)
- `mixmodel-flower-1` (Flower monitoring)
- `mixmodel-postgres-1` (PostgreSQL 16)
- `mixmodel-redis-1` (Redis 7)
- `mixmodel-minio-1` (MinIO, if using self-hosted S3)

### Step 4: Run Database Migrations

```bash
# Run Alembic migrations inside the API container
docker compose exec api alembic upgrade head

# Verify migrations
docker compose exec api alembic current
```

### Step 5: Verify Health

```bash
# Check health endpoint
curl http://localhost:8000/health

# Expected response:
# {
#   "status": "healthy",
#   "version": "0.1.0",
#   "checks": {
#     "database": "healthy",
#     "redis": "healthy",
#     "storage": "healthy",
#     "celery": "healthy"
#   }
# }
```

### Step 6: Access Services

- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs
- **Flower Dashboard:** http://localhost:5555 (admin/YOUR_FLOWER_PASSWORD)
- **MinIO Console:** http://localhost:9001 (minioadmin/minioadmin)

---

## Production Checklist

### Critical Security Steps

- [ ] **Change `JWT_SECRET_KEY`**
  ```bash
  openssl rand -hex 32
  # Add to .env: JWT_SECRET_KEY=<generated-value>
  ```

- [ ] **Change all default passwords**
  - PostgreSQL: `POSTGRES_PASSWORD`
  - MinIO: `S3_ACCESS_KEY`, `S3_SECRET_KEY`
  - Flower: `FLOWER_PASSWORD`

- [ ] **Configure CORS origins**
  ```bash
  CORS_ORIGINS=https://yourdomain.com
  ```

- [ ] **Set `APP_ENV=production` and `APP_DEBUG=false`**

- [ ] **Configure Sentry DSN**
  ```bash
  SENTRY_DSN=https://your-key@sentry.io/project-id
  VITE_SENTRY_DSN=https://your-key@sentry.io/project-id
  ```

### SSL/TLS Configuration

#### Option A: Nginx Reverse Proxy (Recommended)

Install Nginx on the host and configure as reverse proxy:

```nginx
# /etc/nginx/sites-available/mixmodel
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates (use certbot for Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend (React SPA)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE endpoint (increase timeouts)
    location /api/models {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE requires these settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_connect_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # API docs
    location /docs {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Flower (restrict to trusted IPs)
    location /flower {
        allow YOUR_OFFICE_IP;
        deny all;
        proxy_pass http://localhost:5555;
        proxy_set_header Host $host;
    }
}
```

Enable site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/mixmodel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Option B: Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured via systemd timer
sudo systemctl status certbot.timer
```

### Database Backup Strategy

#### Automated PostgreSQL Backups

Create a backup script `/opt/mixmodel/backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/mixmodel/backups
CONTAINER_NAME=mixmodel-postgres-1
DB_NAME=mixmodel

# Create backup directory
mkdir -p $BACKUP_DIR

# Run pg_dump inside container
docker exec $CONTAINER_NAME pg_dump -U mixmodel $DB_NAME | gzip > $BACKUP_DIR/mixmodel_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "mixmodel_*.sql.gz" -mtime +7 -delete

echo "Backup completed: mixmodel_$DATE.sql.gz"
```

Make executable and add to cron:
```bash
chmod +x /opt/mixmodel/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line: 0 2 * * * /opt/mixmodel/backup.sh >> /var/log/mixmodel-backup.log 2>&1
```

#### Restore from Backup

```bash
# Stop services
docker compose stop api celery-worker

# Restore database
gunzip -c /opt/mixmodel/backups/mixmodel_20260210.sql.gz | \
  docker exec -i mixmodel-postgres-1 psql -U mixmodel -d mixmodel

# Restart services
docker compose start api celery-worker
```

### Resource Limits

Edit `docker-compose.yml` to add resource constraints:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  celery-worker:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G  # Model fitting is memory-intensive
        reservations:
          cpus: '2'
          memory: 4G
```

---

## Scaling

### Adding More Celery Workers

To handle more concurrent model runs:

```bash
# Scale Celery worker to 3 replicas
docker compose up -d --scale celery-worker=3

# Verify workers in Flower dashboard
# http://yourdomain.com/flower
```

### Database Read Replicas (Future)

For high-read workloads, configure PostgreSQL streaming replication:

1. Set up read replica with PostgreSQL replication
2. Configure SQLAlchemy read/write routing:

```python
# core/database.py
read_engine = create_async_engine(settings.database_read_url)
write_engine = create_async_engine(settings.database_url)
```

### Horizontal API Scaling

Deploy multiple API containers behind a load balancer:

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 3
```

**Load Balancer Health Check:** Configure to hit `GET /health` every 30 seconds.

---

## Monitoring

### Application Monitoring (Sentry)

1. Sign up at https://sentry.io
2. Create new project (Python + JavaScript)
3. Add DSNs to `.env`:
   ```bash
   SENTRY_DSN=https://your-backend-dsn@sentry.io/123
   VITE_SENTRY_DSN=https://your-frontend-dsn@sentry.io/456
   ```
4. Restart services: `docker compose restart`

**What Sentry Captures:**
- Unhandled exceptions
- Failed HTTP requests (4xx/5xx)
- Performance traces (10% sample rate)

### Celery Monitoring (Flower)

Access Flower dashboard at `http://yourdomain.com:5555` (or behind Nginx proxy).

**Key Metrics:**
- Task success/failure rate
- Worker CPU/memory usage
- Task runtime distribution
- Active/queued tasks

**Alerting:** Configure Flower webhooks for task failures:
```bash
docker compose exec flower celery -A app.tasks.celery_app flower \
  --port=5555 \
  --url_prefix=flower \
  --basic_auth=admin:password \
  --conf=/app/flowerconfig.py
```

### Log Aggregation

**Option A: CloudWatch (AWS):**
```bash
# Install CloudWatch agent
docker run --log-driver=awslogs \
  --log-opt awslogs-group=/mixmodel/api \
  --log-opt awslogs-stream=api \
  ...
```

**Option B: ELK Stack:**
```bash
# Add Filebeat sidecar to docker-compose.yml
filebeat:
  image: docker.elastic.co/beats/filebeat:8.6.0
  volumes:
    - /var/lib/docker/containers:/var/lib/docker/containers:ro
    - ./filebeat.yml:/usr/share/filebeat/filebeat.yml
```

### Database Monitoring

```bash
# Check PostgreSQL stats
docker exec mixmodel-postgres-1 psql -U mixmodel -d mixmodel -c "
  SELECT datname, numbackends, xact_commit, xact_rollback
  FROM pg_stat_database
  WHERE datname = 'mixmodel';
"

# Check slow queries
docker exec mixmodel-postgres-1 psql -U mixmodel -d mixmodel -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"
```

---

## Troubleshooting

### API Container Won't Start

**Check logs:**
```bash
docker compose logs api
```

**Common issues:**
- Database not ready: Wait for PostgreSQL health check to pass
- JWT secret not set: Set `JWT_SECRET_KEY` in `.env`
- Port conflict: Another service using port 8000

### Celery Worker Not Processing Tasks

**Check worker logs:**
```bash
docker compose logs celery-worker
```

**Test Celery connection:**
```bash
docker compose exec celery-worker celery -A app.tasks.celery_app inspect ping
```

**Common issues:**
- Redis connection failed: Check `CELERY_BROKER_URL`
- Import errors: Model code has syntax errors
- Memory exhaustion: Increase worker container memory

### Database Connection Pool Exhausted

**Symptoms:** 500 errors with "connection pool exhausted" in logs

**Solution:** Increase pool size in `core/database.py`:
```python
engine = create_async_engine(
    settings.database_url,
    pool_size=20,      # Increase from default 5
    max_overflow=40,   # Increase from default 10
)
```

### SSE Progress Stream Not Working

**Check browser console:** Should see EventSource connection established

**Common issues:**
- Token expired: Refresh access token before opening SSE stream
- Nginx buffering: Ensure `proxy_buffering off` in Nginx config
- Redis pub/sub not working: Check Redis logs

**Manual test:**
```bash
# Subscribe to Redis channel
docker compose exec redis redis-cli
> SUBSCRIBE model_run:abc-123
```

### MinIO/S3 Upload Failures

**Check MinIO logs:**
```bash
docker compose logs minio
```

**Test S3 connection:**
```bash
docker compose exec api python3 -c "
import boto3
from app.core.config import get_settings

settings = get_settings()
s3 = boto3.client(
    's3',
    endpoint_url=settings.s3_endpoint_url,
    aws_access_key_id=settings.s3_access_key,
    aws_secret_access_key=settings.s3_secret_key,
)
print(s3.list_buckets())
"
```

### High Memory Usage (Celery Worker)

**Symptoms:** Worker OOM (out of memory) killed

**Solutions:**
1. Reduce Celery concurrency:
   ```yaml
   celery-worker:
     command: celery -A app.tasks.celery_app worker --concurrency=1
   ```

2. Increase container memory limit:
   ```yaml
   celery-worker:
     deploy:
       resources:
         limits:
           memory: 16G
   ```

3. Use quick mode for testing (fewer samples):
   ```json
   {"mode": "quick", "n_samples": 500, "n_chains": 2}
   ```

---

## Maintenance

### Update to New Version

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose build

# Stop services
docker compose down

# Start with new images
docker compose up -d

# Run migrations
docker compose exec api alembic upgrade head
```

### Prune Old Data

```bash
# Remove old Docker images
docker image prune -a

# Remove stopped containers
docker container prune

# Remove unused volumes (be careful!)
docker volume prune
```

### View Logs

```bash
# Tail all logs
docker compose logs -f

# Tail specific service
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart api celery-worker
```

---

## Production Architecture Diagram

```
Internet
   |
   v
[Load Balancer / Nginx]
   |
   +---> [FastAPI Container 1] ----+
   |                                |
   +---> [FastAPI Container 2] ----+---> [PostgreSQL]
   |                                |
   +---> [FastAPI Container 3] ----+---> [Redis]
                                    |
                                    +---> [MinIO/S3]

[Celery Worker 1] --+
                    |
[Celery Worker 2] --+---> [Redis Broker]
                    |
[Celery Worker 3] --+

[Flower Dashboard] ---> [Redis]
```

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/mixmodel/issues
- Email: support@mixmodel.com
- Documentation: https://docs.mixmodel.com
