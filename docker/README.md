# Universal AI Tools - Docker Deployment
This directory contains Docker configurations for deploying the Universal AI Tools platform.
## 🚀 Quick Start
### Production Deployment
```bash
# Build and start all services

make prod

# View logs

make prod-logs

# Check health status

make health-check

# Stop all services

make down

```
### Development Deployment
```bash
# Start development environment with hot reload

make dev

# Or start in background

make dev-detached

# View logs

make logs

```
## 📁 Directory Structure
```text

docker/

├── base-go.Dockerfile      # Base Dockerfile for Go services

├── base-rust.Dockerfile    # Base Dockerfile for Rust services

├── orchestrator.Dockerfile # Main orchestrator Dockerfile

└── README.md              # This file
go-services/

├── api-gateway/

│   └── Dockerfile         # API Gateway service

├── cache-coordinator/

│   └── Dockerfile         # Cache Coordinator service

├── load-balancer/

│   └── Dockerfile         # Load Balancer service

└── metrics-aggregator/

    └── Dockerfile         # Metrics Aggregator service
docker-compose.prod.yml     # Production Docker Compose

docker-compose.override.yml # Development overrides

docker-compose.test.yml     # Testing configuration

Makefile                   # Build and deployment commands

```
## 🏗️ Architecture
### Services Overview
- **API Gateway** (port 8080): Main entry point and request routing

- **Cache Coordinator** (port 8012): Redis-based caching layer

- **Load Balancer** (port 8011): Service load balancing

- **Metrics Aggregator** (port 8013): Performance monitoring

- **Chat Service** (port 8016): Real-time chat functionality

- **Memory Service** (port 8017): Memory management

- **WebSocket Hub** (port 8018): WebSocket connections

- **Auth Service** (port 8015): Authentication

- **Legacy Bridge** (port 9999): TypeScript compatibility

- **Redis** (port 6379): Caching and data storage
### Networks
- `universal-ai-network`: Internal service communication

- All services communicate through this network for security
## 🛠️ Development Commands
```bash
# Build all services

make build

# Start services

make up

# Stop services

make down

# View logs

make logs

# Service-specific logs

make api-gateway-logs

make cache-coordinator-logs

# Clean up

make clean

# Redis commands

make redis-cli

make redis-backup

# Monitoring

make monitor

make health-check

```
## 🧪 Testing
```bash
# Run tests

make test

# Run specific service tests

docker-compose -f docker-compose.test.yml run --rm api-gateway-test

```
## 🔧 Configuration
### Environment Variables
Copy `docker/production.env` to `.env` and configure:
```bash

cp docker/production.env .env
# Edit .env with your production values

```
### Service-Specific Configuration
Each service can be configured via environment variables:
- `PORT`: Service port

- `REDIS_ADDR`: Redis connection string

- `LOG_LEVEL`: Logging verbosity

- `SERVICE_NAME`: Service identifier
## 🔒 Security
### Production Considerations
1. **Non-root users**: All containers run as non-root users

2. **Minimal base images**: Using Alpine Linux for smaller attack surface

3. **Health checks**: Built-in health monitoring for all services

4. **Network isolation**: Services communicate through private networks

5. **Environment variables**: Sensitive data passed via environment variables
### Secrets Management
- Use Docker secrets for sensitive data in production

- Never commit secrets to version control

- Rotate keys regularly
## 📊 Monitoring
### Health Checks
All services include health check endpoints:
- `GET /health` - Service health status

- `GET /metrics` - Prometheus metrics (where applicable)
### Logging
- Structured JSON logging in production

- Log aggregation recommended for production deployments

- Development mode includes request logging
## 🚀 Deployment
### Docker Production Deployment
```bash
# 1. Configure environment

cp docker/production.env .env
# Edit .env with production values

# 2. Build and deploy

make prod

# 3. Verify deployment

make health-check

curl http://your-server:8080/health

```
### Scaling Services
```bash
# Scale API Gateway to 3 instances

make scale SERVICE=api-gateway COUNT=3

# Scale Cache Coordinator

make scale SERVICE=cache-coordinator COUNT=2

```
### Rolling Updates
```bash
# Update services without downtime

docker-compose -f docker-compose.prod.yml up -d --no-deps service-name

```
## 🔍 Troubleshooting
### Common Issues
1. **Port conflicts**: Ensure host ports are available

2. **Redis connection**: Verify Redis is healthy before starting dependent services

3. **Memory issues**: Monitor container resource usage

4. **Network issues**: Check Docker network connectivity
### Debugging
```bash
# View service logs

make logs

# Check container status

make ps

# Restart specific service

docker-compose -f docker-compose.prod.yml restart service-name

# View container logs

docker-compose -f docker-compose.prod.yml logs service-name

```
## 📈 Performance Optimization
### Resource Limits
Configure resource limits in `docker-compose.prod.yml`:
```yaml

services:

  api-gateway:

    deploy:

      resources:

        limits:

          memory: 512M

          cpus: '0.50'

        reservations:

          memory: 256M

          cpus: '0.25'

```
### Caching
- Redis is configured for optimal performance

- Connection pooling prevents connection exhaustion

- Persistent volumes for data durability
## 🔄 CI/CD Integration
### GitHub Actions Example
```yaml

name: Docker Build and Push
on:

  push:

    branches: [main]
jobs:

  build:

    runs-on: ubuntu-latest
    steps:

      - uses: actions/checkout@v3
      - name: Build Docker images

        run: make build
      - name: Run tests

        run: make test
      - name: Push to registry

        run: |

          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin

          docker-compose -f docker-compose.prod.yml push

```
---
## 📞 Support
For deployment issues or questions:
- Check the logs: `make logs`

- Verify health: `make health-check`

- Review configuration in `docker-compose.prod.yml`

- Ensure all required environment variables are set
