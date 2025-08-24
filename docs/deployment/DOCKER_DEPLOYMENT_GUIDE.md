# Universal AI Tools - Docker Deployment Guide

This guide provides comprehensive instructions for deploying Universal AI Tools using Docker with proper configuration, security, and monitoring.

## 🚀 Quick Start

### Prerequisites

- Docker Desktop 4.0+ or Docker Engine 20.10+
- Docker Compose v2.0+
- At least 8GB RAM available for containers
- 50GB+ free disk space

### Environment Setup

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd universal-ai-tools
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual configuration values
   nano .env
   ```

3. **Start services:**
   ```bash
   # Development environment
   ./scripts/docker-manager.sh start

   # Production environment
   ./scripts/docker-manager.sh start-prod
   ```

## 📋 Environment Configuration

### Required Variables

The following environment variables **must** be configured before deployment:

#### Database Configuration
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-postgres-password  # Change this!
POSTGRES_DB=universal_ai_tools
```

#### Supabase Configuration
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

#### Security Configuration
```env
# Generate with: openssl rand -hex 32
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
```

#### AI API Keys (Optional - for AI features)
```env
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key
```

### Optional Configuration

#### Performance Tuning
```env
MAX_CONCURRENT_REQUESTS=50
REQUEST_TIMEOUT=30000
MEMORY_CACHE_SIZE=512
```

#### Memory Optimization
```env
MEMORY_MONITORING_INTERVAL=120000
GC_INTERVAL_MS=120000
CACHE_CLEANUP_INTERVAL_MS=180000
```

## 🐳 Service Architecture

### Core Services

| Service | Description | Port | Health Check |
|---------|-------------|------|--------------|
| **app** | Main application server | 9999 | `/api/health` |
| **postgres** | PostgreSQL database | 5432 | `pg_isready` |
| **redis** | Cache and session store | 6379 | `redis-cli ping` |
| **ollama** | Local LLM inference | 11434 | `/api/tags` |

### Optional Services (Profiles)

#### Monitoring Profile
- **prometheus**: Metrics collection (port 9090)
- **grafana**: Visualization dashboard (port 3003)

#### Tools Profile
- **pgadmin**: Database management (port 5050)
- **redis-commander**: Redis management (port 8081)

#### MCP Profile
- **mcp-servers**: AI agent integration (ports 3001-3008)

## 🚀 Deployment Options

### Development Deployment

For local development with hot reload and debugging:

```bash
# Start basic services
./scripts/docker-manager.sh start

# Start with monitoring
./scripts/docker-manager.sh start monitoring

# Start with all tools
./scripts/docker-manager.sh start tools
```

**Development URLs:**
- Application: http://localhost:9999
- API Health: http://localhost:9999/api/health
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Production Deployment

For production environments with optimized settings:

```bash
# Start production services
./scripts/docker-manager.sh start-prod
```

**Production URLs:**
- Application: http://localhost:9998 (different port for security)
- Prometheus: http://127.0.0.1:9090 (localhost only)
- Grafana: http://127.0.0.1:3003 (localhost only)

### Profile-based Deployment

Start specific service groups:

```bash
# Monitoring stack
docker-compose --profile monitoring up -d

# Development tools
docker-compose --profile tools up -d

# MCP servers for AI agents
docker-compose --profile mcp up -d

# Everything
docker-compose --profile full up -d
```

## 🔧 Management Commands

### Using Docker Manager Script

The `scripts/docker-manager.sh` script provides comprehensive container management:

```bash
# Service Management
./scripts/docker-manager.sh start [profile]    # Start services
./scripts/docker-manager.sh stop              # Stop all services
./scripts/docker-manager.sh restart [profile] # Restart services
./scripts/docker-manager.sh status            # Show service status

# Monitoring
./scripts/docker-manager.sh health            # Run health checks
./scripts/docker-manager.sh monitor           # Show resource usage
./scripts/docker-manager.sh logs [service]    # Show logs

# Maintenance
./scripts/docker-manager.sh cleanup           # Clean unused resources
./scripts/docker-manager.sh backup [dir]      # Backup volumes
./scripts/docker-manager.sh reset             # Reset everything (destructive!)
```

### Manual Docker Commands

For direct Docker management:

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f [service]

# Scale services
docker-compose up -d --scale app=3

# Update single service
docker-compose up -d --no-deps app
```

## 🔍 Health Monitoring

### Automated Health Checks

All services include comprehensive health checks:

- **Startup Period**: 30-90s depending on service
- **Check Interval**: 10-60s depending on service complexity
- **Timeout**: 5-10s per check
- **Retries**: 3-5 attempts before marking unhealthy

### Manual Health Verification

```bash
# Check all services
./scripts/docker-manager.sh health

# Individual service checks
curl -f http://localhost:9999/api/health        # Application
docker exec universal-ai-tools-postgres pg_isready -U postgres  # PostgreSQL
docker exec universal-ai-tools-redis redis-cli ping             # Redis
curl -f http://localhost:11434/api/tags         # Ollama
```

### Monitoring Dashboards

With the monitoring profile enabled:

- **Prometheus**: http://localhost:9090
  - Metrics collection and alerting
  - Custom application metrics
  - Container resource metrics

- **Grafana**: http://localhost:3003
  - Username: `admin`
  - Password: `admin` (change after first login)
  - Pre-configured dashboards for application and infrastructure metrics

## 📊 Resource Requirements

### Minimum Requirements

| Service | CPU | Memory | Disk |
|---------|-----|--------|------|
| app | 1 core | 1.5GB | 5GB |
| postgres | 0.5 core | 512MB | 10GB |
| redis | 0.25 core | 1GB | 1GB |
| ollama | 2 cores | 2GB | 20GB |
| **Total** | **3.75 cores** | **5GB** | **36GB** |

### Recommended Production

| Service | CPU | Memory | Disk |
|---------|-----|--------|------|
| app | 2 cores | 3GB | 10GB |
| postgres | 1 core | 1GB | 50GB |
| redis | 0.5 core | 2GB | 5GB |
| ollama | 4 cores | 6GB | 100GB |
| **Total** | **7.5 cores** | **12GB** | **165GB** |

### Memory Optimization

The application includes automatic memory optimization based on available resources:

- **Low Memory (< 1GB)**: Enables aggressive memory optimization
- **Medium Memory (1-2GB)**: Balanced memory settings
- **High Memory (> 2GB)**: Optimal performance settings

## 🔒 Security Considerations

### Environment Security

1. **Never commit .env files** to version control
2. **Use strong passwords** for all database and service accounts
3. **Generate secure JWT secrets** using cryptographically secure methods
4. **Rotate API keys regularly** in production environments

### Network Security

Production configuration includes:

- **Localhost-only binding** for sensitive services (Prometheus, Grafana)
- **Internal Docker networks** for service communication
- **Minimal port exposure** to host system
- **Health check endpoints** without sensitive data exposure

### Container Security

- **Non-root user execution** for application containers
- **Resource limits** to prevent DoS attacks
- **Security scanning** of base images
- **Minimal attack surface** with Alpine Linux base images

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start

1. **Check environment variables:**
   ```bash
   ./scripts/docker-manager.sh health
   ```

2. **Verify Docker resources:**
   ```bash
   docker system df
   docker stats --no-stream
   ```

3. **Check service logs:**
   ```bash
   ./scripts/docker-manager.sh logs [service]
   ```

#### Database Connection Issues

1. **Verify PostgreSQL is running:**
   ```bash
   docker exec universal-ai-tools-postgres pg_isready -U postgres
   ```

2. **Check database credentials in .env**

3. **Reset database if corrupted:**
   ```bash
   docker-compose down -v
   docker volume rm universal-ai-tools_postgres_data
   ./scripts/docker-manager.sh start
   ```

#### Memory Issues

1. **Check container memory usage:**
   ```bash
   ./scripts/docker-manager.sh monitor
   ```

2. **Increase Docker Desktop memory allocation** (minimum 8GB recommended)

3. **Enable memory optimization:**
   ```env
   ENABLE_MEMORY_OPTIMIZATION=true
   MEMORY_WARNING_THRESHOLD=70
   ```

#### Port Conflicts

1. **Check for conflicting services:**
   ```bash
   lsof -i :9999  # Check if port is in use
   ```

2. **Modify ports in docker-compose.yml** if needed

3. **Use production configuration** with different port mappings

### Log Analysis

```bash
# Application logs
./scripts/docker-manager.sh logs app

# Database logs
./scripts/docker-manager.sh logs postgres

# All service logs
./scripts/docker-manager.sh logs

# Follow logs in real-time
docker-compose logs -f --tail=100
```

### Performance Debugging

```bash
# Resource monitoring
./scripts/docker-manager.sh monitor

# Container inspection
docker inspect universal-ai-tools-app

# Network debugging
docker network ls
docker network inspect universal-ai-tools_ai-network
```

## 🔄 Backup and Recovery

### Automated Backups

```bash
# Backup all volumes
./scripts/docker-manager.sh backup /path/to/backup/directory

# Manual volume backup
docker run --rm \
  -v universal-ai-tools_postgres_data:/data \
  -v /host/backup:/backup \
  alpine tar czf /backup/postgres_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### Recovery Process

```bash
# Stop services
./scripts/docker-manager.sh stop

# Restore volume
docker run --rm \
  -v universal-ai-tools_postgres_data:/data \
  -v /host/backup:/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /data

# Restart services
./scripts/docker-manager.sh start
```

## 🔧 Customization

### Custom Docker Compose

Create `docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'
services:
  app:
    ports:
      - '8080:9999'  # Different port mapping
    environment:
      - CUSTOM_VAR=custom_value
```

### Environment-specific Configurations

```bash
# Development
cp docker-compose.yml docker-compose.dev.yml
# Modify for development needs

# Staging
cp docker-compose.prod.yml docker-compose.staging.yml
# Modify for staging environment
```

## 📈 Scaling and Performance

### Horizontal Scaling

```bash
# Scale application instances
docker-compose up -d --scale app=3

# Load balancer configuration needed for multiple instances
```

### Performance Tuning

1. **Database optimization:**
   ```env
   POSTGRES_MAX_CONNECTIONS=200
   POSTGRES_SHARED_BUFFERS=512MB
   POSTGRES_EFFECTIVE_CACHE_SIZE=2GB
   ```

2. **Redis optimization:**
   ```bash
   # In docker-compose.yml
   command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
   ```

3. **Application optimization:**
   ```env
   MAX_CONCURRENT_REQUESTS=100
   NODE_OPTIONS="--max-old-space-size=2048"
   ```

## 🆘 Support

### Getting Help

1. **Check logs first:**
   ```bash
   ./scripts/docker-manager.sh logs
   ```

2. **Run health checks:**
   ```bash
   ./scripts/docker-manager.sh health
   ```

3. **Check resource usage:**
   ```bash
   ./scripts/docker-manager.sh monitor
   ```

4. **Review configuration:**
   ```bash
   cat .env
   docker-compose config
   ```

### Reporting Issues

When reporting issues, please include:

1. **Environment information:**
   ```bash
   docker version
   docker-compose version
   ./scripts/docker-manager.sh status
   ```

2. **Service logs:**
   ```bash
   ./scripts/docker-manager.sh logs > deployment_logs.txt
   ```

3. **System resources:**
   ```bash
   ./scripts/docker-manager.sh monitor > resource_usage.txt
   ```

This comprehensive guide should help you deploy and manage Universal AI Tools effectively using Docker. For additional support, refer to the project documentation or contact the development team.