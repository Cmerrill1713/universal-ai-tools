# Docker Setup Guide for Universal AI Tools
This guide provides comprehensive instructions for setting up and running Universal AI Tools using Docker.
## Table of Contents
1. [Prerequisites](#prerequisites)

2. [Quick Start](#quick-start)

3. [Service Architecture](#service-architecture)

4. [Configuration](#configuration)

5. [Development Setup](#development-setup)

6. [Production Deployment](#production-deployment)

7. [Service Management](#service-management)

8. [Monitoring & Observability](#monitoring--observability)

9. [Troubleshooting](#troubleshooting)

10. [Security Considerations](#security-considerations)
## Prerequisites
- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))

- Docker Compose v2.0+ (included with Docker Desktop)

- 8GB+ RAM recommended (16GB for optimal performance)

- 20GB+ free disk space
### System Requirements by Service
| Service | Min RAM | Recommended RAM | Disk Space |

|---------|---------|-----------------|------------|

| App | 512MB | 1GB | 1GB |

| PostgreSQL | 256MB | 1GB | 5GB |

| Redis | 256MB | 512MB | 2GB |

| Ollama | 4GB | 8GB | 10GB+ |

| Nginx | 64MB | 128MB | 100MB |

| Prometheus | 512MB | 1GB | 5GB |

| Grafana | 256MB | 512MB | 1GB |
## Quick Start
1. **Clone the repository:**

   ```bash

   git clone https://github.com/your-org/universal-ai-tools.git

   cd universal-ai-tools

   ```
2. **Copy environment variables:**

   ```bash

   cp .env.docker.example .env

   ```
3. **Edit `.env` file with your configuration:**

   ```bash

   # Required: Add your Supabase credentials

   SUPABASE_URL=https://your-project.supabase.co

   SUPABASE_ANON_KEY=your-anon-key

   SUPABASE_SERVICE_KEY=your-service-key

   

   # Required: Set secure passwords

   JWT_SECRET=$(openssl rand -hex 32)

   ENCRYPTION_KEY=$(openssl rand -hex 32)

   REDIS_PASSWORD=$(openssl rand -hex 16)

   ```
4. **Start all services:**

   ```bash

   docker-compose up -d

   ```
5. **Check service status:**

   ```bash

   docker-compose ps

   ```
6. **Access the services:**

   - Main API: http://localhost:8080

   - Health Check: http://localhost:8080/health

   - Ollama: http://localhost:11434

   - Grafana: http://localhost:3003 (admin/admin)

   - Prometheus: http://localhost:9090

   - pgAdmin: http://localhost:5050 (with `--profile tools`)

   - Redis Commander: http://localhost:8081 (with `--profile tools`)
7. **Optional: Run automated codebase management:**

   ```bash

   # Preview file organization

   docker-compose exec app npm run organize:files:check

   

   # Execute file organization

   docker-compose exec app npm run organize:files

   

   # Preview cleanup unused files/directories

   docker-compose exec app npm run cleanup:unused:check

   

   # Execute safe cleanup

   docker-compose exec app npm run cleanup:unused

   ```
## Service Architecture
```

┌─────────────────┐     ┌──────────────────────────┐

│                 │────▶│                          │

│     Nginx       │     │     Universal AI Tools   │

│  (Reverse Proxy)│     │    (v2.0 Production)    │

│                 │◀────│  + Codebase Automation   │

└─────────────────┘     └──────────────────────────┘

         │                              │

         │              ┌───────────────┴───────────────┐

         │              │                               │

         ▼              ▼                               ▼

┌─────────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐

│                 │ │          │ │            │ │          │

│     Ollama      │ │  Redis   │ │ PostgreSQL │ │ Rust     │

│  (LLM Service)  │ │  (Cache) │ │    (DB)    │ │ Services │

│                 │ │          │ │            │ │ (AB-MCTS)│

└─────────────────┘ └──────────┘ └────────────┘ └──────────┘

                           │

                    ┌──────┴──────┐

                    │             │

                    ▼             ▼

              ┌──────────┐ ┌──────────┐

              │          │ │          │

              │Prometheus│ │ Grafana  │

              │(Metrics) │ │  (Viz)   │

              │          │ │          │

              └──────────┘ └──────────┘

```
## Configuration
### Environment Variables
Create a `.env` file based on `.env.docker.example`:
```bash
# Core Configuration

NODE_ENV=production

PORT=8080

# Database

DATABASE_URL=postgresql://postgres:postgres@postgres:5432/universal_ai_tools

# Supabase (External)

SUPABASE_URL=https://your-project.supabase.co

SUPABASE_ANON_KEY=your-anon-key

SUPABASE_SERVICE_KEY=your-service-key

# Security (Generate secure keys!)

JWT_SECRET=$(openssl rand -hex 32)

ENCRYPTION_KEY=$(openssl rand -hex 32)

REDIS_PASSWORD=$(openssl rand -hex 16)

# AI Services (Optional)

OPENAI_API_KEY=sk-...

ANTHROPIC_API_KEY=sk-ant-...

# Local LLM

OLLAMA_URL=http://ollama:11434

```
### Volume Mounts
The following volumes are created for data persistence:
- `postgres_data`: PostgreSQL database files

- `redis_data`: Redis persistence files

- `ollama_models`: Downloaded LLM models

- `model_cache`: Application model cache

- `prometheus_data`: Time-series metrics data

- `grafana_data`: Dashboards and settings

- `nginx_cache`: HTTP cache
### Network Configuration
All services communicate on the `ai-network` bridge network (172.20.0.0/16).
## Development Setup
### Using Docker Compose Override
The `docker-compose.override.yml` file automatically applies development settings:
```bash
# Start in development mode (with hot reload)

docker-compose up

# Or explicitly use development settings

docker-compose -f docker-compose.yml -f docker-compose.override.yml up

```
### Development Features
- Source code mounted for hot reload

- Debug logging enabled

- All ports exposed for direct access

- No authentication on Redis

- pgAdmin and Redis Commander enabled
### Debugging
```bash
# View logs for all services

docker-compose logs -f

# View logs for specific service

docker-compose logs -f app

# Access container shell

docker-compose exec app sh

# Run commands in container

docker-compose exec app npm test

```
## Production Deployment
### 1. SSL/TLS Setup
Create SSL certificates:
```bash
# Self-signed (development only)

mkdir -p nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \

  -keyout nginx/ssl/key.pem \

  -out nginx/ssl/cert.pem

# Or use Let's Encrypt (production)

docker-compose run --rm certbot certonly \

  --webroot -w /var/www/certbot \

  -d yourdomain.com

```
### 2. Production Configuration
```bash
# Use production compose file

docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale services

docker-compose up -d --scale app=3

```
### 3. Database Migrations
```bash
# Run migrations

docker-compose exec app npm run migrate

# Create backup

docker-compose exec postgres pg_dump -U postgres universal_ai_tools > backup.sql

```
### 4. Health Checks
All services include health checks. Monitor status:
```bash
# Check health status

docker-compose ps

# Custom health check

curl http://localhost:8080/api/health

```
## Service Management
### Starting Services
```bash
# Start all services

docker-compose up -d

# Start specific services

docker-compose up -d app redis postgres

# Start with build

docker-compose up -d --build

```
### Stopping Services
```bash
# Stop all services

docker-compose down

# Stop and remove volumes (CAUTION: deletes data!)

docker-compose down -v

# Stop specific service

docker-compose stop app

```
### Updating Services
```bash
# Pull latest images

docker-compose pull

# Rebuild and restart

docker-compose up -d --build

# Update specific service

docker-compose pull app

docker-compose up -d app

```
### Ollama Model Management
```bash
# List models

docker-compose exec ollama ollama list

# Pull new model

docker-compose exec ollama ollama pull llama3.2:3b

# Remove model

docker-compose exec ollama ollama rm llama3.2:3b

```
### Codebase Automation Management
```bash
# Preview file organization changes

docker-compose exec app npm run organize:files:check

# Execute file organization

docker-compose exec app npm run organize:files

# Preview unused file cleanup

docker-compose exec app npm run cleanup:unused:check

# Execute safe cleanup (only removes safe files)

docker-compose exec app npm run cleanup:unused

# Execute complete cleanup (requires review for unsafe items)

docker-compose exec app npm run cleanup:unused -- --force

# Run complete codebase organization

docker-compose exec app npm run cleanup:all

```
## Monitoring & Observability
### Accessing Monitoring Tools
- **Grafana**: http://localhost:3003

  - Default credentials: admin/admin

  - Pre-configured dashboards for all services
- **Prometheus**: http://localhost:9090

  - Query metrics directly

  - View targets and scrape status
### Key Metrics to Monitor
1. **Application Metrics:**

   - Request rate and latency

   - Error rates

   - Active connections

   - Memory usage
2. **Database Metrics:**

   - Connection pool usage

   - Query performance

   - Disk usage
3. **Cache Metrics:**

   - Hit/miss ratio

   - Memory usage

   - Eviction rate
### Setting Up Alerts
Create `monitoring/prometheus/alerts/app.yml`:
```yaml

groups:

  - name: app_alerts

    rules:

      - alert: HighErrorRate

        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05

        for: 5m

        labels:

          severity: warning

        annotations:

          summary: High error rate detected

```
## Troubleshooting
### Common Issues
1. **Container won't start:**

   ```bash

   # Check logs

   docker-compose logs app

   

   # Verify environment variables

   docker-compose config

   ```
2. **Database connection issues:**

   ```bash

   # Test database connection

   docker-compose exec postgres psql -U postgres -d universal_ai_tools

   

   # Check if migrations ran

   docker-compose exec app npm run migrate:status

   ```
3. **Ollama not responding:**

   ```bash

   # Check Ollama status

   docker-compose exec ollama ollama list

   

   # Restart Ollama

   docker-compose restart ollama

   ```
4. **Port conflicts:**

   ```bash

   # Check port usage

   lsof -i :8080

   

   # Change port in .env

   PORT=8081

   ```
### Debug Commands
```bash
# View container resource usage

docker stats

# Inspect container

docker-compose exec app sh

# Check network connectivity

docker-compose exec app ping postgres

# View environment variables

docker-compose exec app env

# Test internal services

docker-compose exec app curl http://ollama:11434/api/tags

```
### Logs and Debugging
```bash
# Follow all logs

docker-compose logs -f

# Last 100 lines of app logs

docker-compose logs --tail=100 app

# Export logs

docker-compose logs > docker-logs.txt

# Enable debug mode

DEBUG=* docker-compose up

```
## Security Considerations
### 1. Environment Variables
- Never commit `.env` files to version control

- Use strong, unique passwords for all services

- Rotate secrets regularly
### 2. Network Security
- Use internal networks for service communication

- Expose only necessary ports

- Implement firewall rules for production
### 3. Container Security
- Run containers as non-root users

- Keep base images updated

- Scan images for vulnerabilities:

  ```bash

  docker scan universal-ai-tools:latest

  ```
### 4. Data Security
- Encrypt volumes for sensitive data

- Regular backups of persistent volumes

- Use SSL/TLS for all external communication
### 5. Access Control
- Implement proper authentication

- Use API keys for service access

- Monitor access logs
## Advanced Configuration
### Custom Ollama Models
```yaml
# docker-compose.custom.yml

services:

  ollama:

    environment:

      - OLLAMA_MODELS=/models

    volumes:

      - ./custom-models:/models

```
### Multi-Host Deployment
```yaml
# docker-compose.swarm.yml

version: '3.8'

services:

  app:

    deploy:

      replicas: 3

      placement:

        constraints:

          - node.role == worker

```
### Resource Limits
```yaml
# docker-compose.limits.yml

services:

  app:

    deploy:

      resources:

        limits:

          cpus: '2'

          memory: 2G

        reservations:

          cpus: '1'

          memory: 1G

```
## Maintenance
### Regular Tasks
1. **Weekly:**

   - Check disk usage: `docker system df`

   - Review logs for errors

   - Update Ollama models
2. **Monthly:**

   - Update base images: `docker-compose pull`

   - Clean unused resources: `docker system prune`

   - Review security updates
3. **Quarterly:**

   - Rotate secrets and API keys

   - Review and update configurations

   - Performance optimization
### Backup Strategy
```bash
# Backup script
#!/bin/bash

DATE=$(date +%Y%m%d)

# Backup database

docker-compose exec -T postgres pg_dump -U postgres universal_ai_tools > backup_db_$DATE.sql

# Backup volumes

docker run --rm -v universal-ai-tools_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data_$DATE.tar.gz -C /data .

# Backup configurations

tar czf config_backup_$DATE.tar.gz .env docker-compose*.yml nginx/

```
## Support and Resources
- [Docker Documentation](https://docs.docker.com/)

- [Docker Compose Reference](https://docs.docker.com/compose/)

- [Universal AI Tools Documentation](https://github.com/your-org/universal-ai-tools)

- [Issue Tracker](https://github.com/your-org/universal-ai-tools/issues)
For production deployments, consider using:

- Kubernetes for orchestration

- Cloud providers' container services

- Managed databases and caching services

- CDN for static assets

- Professional monitoring solutions