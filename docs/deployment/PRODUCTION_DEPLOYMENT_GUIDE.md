# Universal AI Tools - Production Deployment Guide

## 🚀 Overview

This guide provides complete instructions for deploying Universal AI Tools to production with optimized memory usage (<1GB total), comprehensive monitoring, and security best practices using keyring for secrets management.
- **Memory Target**: <1GB total system memory usage
- **Service Consolidation**: Reduced from 68 services to 10 core services
- **Performance Optimization**: HTTP timeout configuration and response time improvements
- **Monitoring**: Comprehensive alerting and health checks

## Quick Start

```bash
# 1. Configure environment
cp .env.production.template .env
# Edit .env with your production values

# 2. Deploy optimized production stack
./scripts/deploy-production-optimized.sh

# 3. Setup health monitoring
./scripts/setup-health-checks.sh

# 4. Configure automated backups
./scripts/backup-recovery-system.sh setup-auto
```

## Memory Optimization Summary

### Target Architecture
- **Total Memory**: <1GB across all services
- **API Service**: 512MB (core application)
- **PostgreSQL**: 256MB (database)
- **Redis**: 64MB (ultra-lightweight cache)
- **Ollama**: 256MB (local AI)
- **Prometheus**: 128MB (monitoring)
- **Grafana**: 128MB (dashboards)
- **Alertmanager**: 64MB (alerting)
- **Nginx**: 128MB (reverse proxy)

### Service Consolidation
- **Before**: 68 individual services
- **After**: 10 consolidated services (85% reduction)
- **Benefits**: Reduced memory overhead, simplified management, faster startup

## Production Configuration Files

### Core Files
- `docker-compose.prod.yml` - Optimized production containers
- `.env.production` - Production environment variables
- `monitoring/prometheus/prometheus.prod.yml` - Memory-optimized metrics collection
- `monitoring/alertmanager/alertmanager.prod.yml` - Production alerting rules

### Scripts
- `scripts/deploy-production-optimized.sh` - Main deployment script
- `scripts/setup-health-checks.sh` - Health monitoring setup
- `scripts/backup-recovery-system.sh` - Backup and recovery system

## Pre-Deployment Requirements

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended)
- **Memory**: 2GB minimum (4GB recommended for headroom)
- **CPU**: 2 cores minimum
- **Storage**: 20GB minimum
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+

### Network Requirements
- **Ports**: 80, 443, 9999, 9090, 3003, 9093
- **SSL Certificates**: Required for HTTPS (place in `./nginx/ssl/`)
- **Domain**: Configure DNS to point to your server

### Required Environment Variables

Edit `.env.production` with your actual values:

```bash
# Database (REQUIRED)
POSTGRES_PASSWORD=your-secure-database-password

# Security (REQUIRED)
JWT_SECRET=$(openssl rand -hex 32)

# AI API Keys (REQUIRED)
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key

# Supabase (REQUIRED)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Admin Passwords (REQUIRED)
GRAFANA_ADMIN_PASSWORD=your-grafana-password
PGADMIN_PASSWORD=your-pgadmin-password

# Domain Configuration
CORS_ORIGIN=https://yourdomain.com
```

## Deployment Process

### Step 1: Pre-Deployment Preparation

1. **Clone Repository**:
   ```bash
   git clone https://github.com/your-org/universal-ai-tools.git
   cd universal-ai-tools
   ```

2. **Configure Environment**:
   ```bash
   cp .env.production.template .env
   # Edit .env with your production values
   ```

3. **Setup SSL Certificates**:
   ```bash
   mkdir -p nginx/ssl
   # Copy your SSL certificate files:
   # nginx/ssl/cert.pem (certificate)
   # nginx/ssl/key.pem (private key)
   ```

### Step 2: Deploy Production Stack

```bash
# Deploy with pre-deployment checks and validation
./scripts/deploy-production-optimized.sh
```

The deployment script will:
- ✅ Run pre-deployment validation
- ✅ Create backup of current deployment
- ✅ Deploy optimized services with resource limits
- ✅ Validate memory usage (<1GB target)
- ✅ Test API endpoints and health checks
- ✅ Setup monitoring and alerting

### Step 3: Configure Health Monitoring

```bash
# Setup comprehensive health checks
./scripts/setup-health-checks.sh

# Start continuous monitoring (optional)
nohup ./monitoring/health-checks/memory-monitor.sh &
nohup ./monitoring/health-checks/performance-monitor.sh &
```

### Step 4: Setup Automated Backups

```bash
# Configure automated backup system
./scripts/backup-recovery-system.sh setup-auto

# Test backup system
./scripts/backup-recovery-system.sh backup full
```

## Service URLs and Access

After successful deployment:

| Service | URL | Credentials |
|---------|-----|-------------|
| **API** | `https://yourdomain.com` | N/A |
| **Health Check** | `https://yourdomain.com/health` | N/A |
| **API Metrics** | `https://yourdomain.com/metrics` | N/A |
| **Prometheus** | `https://yourdomain.com:9090` | N/A |
| **Grafana** | `https://yourdomain.com:3003` | admin / [GRAFANA_ADMIN_PASSWORD] |
| **Alertmanager** | `https://yourdomain.com:9093` | N/A |

## Monitoring and Alerting

### Memory Usage Alerts
- **Critical**: Total memory usage >950MB (approaching 1GB limit)
- **Warning**: Individual service memory exceeds allocated limits
- **Info**: Memory optimization recommendations

### Service Health Alerts
- **Critical**: Any consolidated service down >1 minute
- **Warning**: High error rate (>5%) in API services
- **Warning**: Response time >500ms (95th percentile)

### Performance Alerts
- **Critical**: HTTP timeout errors detected
- **Warning**: API response time >500ms
- **Info**: Database connection count approaching limits

### Alert Channels
Configure in `monitoring/alertmanager/alertmanager.prod.yml`:
- **Email**: Send to operations team
- **Webhook**: Integrate with Slack, PagerDuty, etc.
- **Dashboard**: View in Grafana

## Backup and Recovery

### Automated Backups
- **Schedule**: Daily at 2 AM (configurable)
- **Retention**: 30 days (configurable)
- **Types**: Full, Data-only, Config-only
- **Location**: `./backups/`

### Manual Backup
```bash
# Full backup (recommended)
./scripts/backup-recovery-system.sh backup full

# Data only backup
./scripts/backup-recovery-system.sh backup data

# Configuration only backup
./scripts/backup-recovery-system.sh backup config
```

### Recovery Process
```bash
# List available backups
./scripts/backup-recovery-system.sh list

# Restore from specific backup
./scripts/backup-recovery-system.sh restore full_20240820_143022
```

## Performance Optimization

### Memory Optimization Features
1. **Service Consolidation**: 68→10 services reduces overhead
2. **Resource Limits**: Strict memory limits per service
3. **Garbage Collection**: Optimized GC intervals
4. **Cache Management**: Automatic cache cleanup
5. **Memory Monitoring**: Real-time usage tracking

### HTTP Timeout Configuration
- **Keep-Alive Timeout**: 120 seconds
- **Headers Timeout**: 121 seconds  
- **Request Timeout**: 15 seconds
- **Max Concurrent Requests**: 100

### Database Optimization
- **Max Connections**: 50 (reduced from 200)
- **Shared Buffers**: 64MB
- **Work Memory**: 2MB per operation
- **Effective Cache Size**: 256MB

## Security Considerations

### Environment Security
- ✅ Secure JWT secrets (32+ character random strings)
- ✅ Strong database passwords
- ✅ HTTPS with valid SSL certificates
- ✅ CORS configuration for allowed origins
- ✅ Rate limiting (200 requests per 15 minutes)

### Container Security
- ✅ Non-root user execution
- ✅ Resource limits prevent DoS
- ✅ Health checks prevent unhealthy containers
- ✅ Regular security updates

### Network Security
- ✅ Internal service communication only
- ✅ External access through Nginx proxy only
- ✅ SSL termination at proxy level
- ✅ Security headers configured

## Troubleshooting

### Common Issues

#### Memory Usage Exceeding Target
1. **Check Memory Usage**:
   ```bash
   docker stats
   ./monitoring/health-checks/health-check.sh
   ```

2. **Identify High Memory Services**:
   ```bash
   docker stats --format "table {{.Container}}\t{{.MemUsage}}"
   ```

3. **Restart High Memory Services**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart <service-name>
   ```

#### Service Health Check Failures
1. **Check Service Logs**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs <service-name>
   ```

2. **Verify Environment Configuration**:
   ```bash
   grep -E "(SECRET|PASSWORD|KEY)" .env
   ```

3. **Test API Endpoints**:
   ```bash
   curl -f http://localhost:9999/health
   ```

#### Deployment Failures
1. **Check Pre-deployment Requirements**:
   ```bash
   ./scripts/deploy-production-optimized.sh --help
   ```

2. **Review Deployment Logs**:
   ```bash
   tail -f logs/deployment-*.log
   ```

3. **Rollback if Necessary**:
   ```bash
   ./scripts/deploy-production-optimized.sh --rollback
   ```

### Performance Debugging

#### Slow API Response Times
1. **Check Prometheus Metrics**: `http://localhost:9090`
2. **Review Performance Logs**: `./logs/performance-*.log`
3. **Analyze Database Performance**: Check connection count and query times
4. **Monitor Redis Performance**: Check hit rates and memory usage

#### Memory Leaks
1. **Enable Memory Monitoring**: 
   ```bash
   ./monitoring/health-checks/memory-monitor.sh
   ```
2. **Review Memory Logs**: `./logs/memory-usage-*.log`
3. **Restart Affected Services**: Use rolling restart to maintain availability

## Scaling Considerations

### Horizontal Scaling
- **Load Balancer**: Add Nginx upstream configuration
- **Database**: Consider read replicas for read-heavy workloads
- **Redis**: Implement Redis Cluster for larger datasets
- **Monitoring**: Scale Prometheus with federation

### Vertical Scaling
- **Memory**: Increase memory limits proportionally
- **CPU**: Adjust CPU limits based on workload
- **Storage**: Monitor disk usage and expand as needed

## Maintenance

### Regular Tasks
- **Weekly**: Review memory usage trends and optimization opportunities
- **Monthly**: Update Docker images and security patches
- **Quarterly**: Review and test backup/recovery procedures
- **Annually**: Security audit and penetration testing

### Update Process
1. **Test in Staging**: Deploy updates to staging environment first
2. **Backup Production**: Create full backup before updates
3. **Rolling Update**: Update services one at a time
4. **Validate**: Run health checks after updates
5. **Rollback**: Use backup if issues occur

## Support and Documentation

### Logs and Debugging
- **Application Logs**: `./logs/`
- **Health Check Logs**: `./logs/health-check-*.log`
- **Memory Usage Logs**: `./logs/memory-usage-*.log`
- **Performance Logs**: `./logs/performance-*.log`
- **Deployment Logs**: `./logs/deployment-*.log`

### Monitoring Dashboards
- **Grafana**: System overview and service metrics
- **Prometheus**: Raw metrics and alerting rules
- **Alertmanager**: Alert status and routing

### Configuration Files
- **Docker Compose**: `docker-compose.prod.yml`
- **Environment**: `.env.production`
- **Nginx**: `nginx/nginx.prod.conf`
- **Prometheus**: `monitoring/prometheus/prometheus.prod.yml`
- **Alertmanager**: `monitoring/alertmanager/alertmanager.prod.yml`

For additional support, refer to the project documentation or create an issue in the repository.

---

## Quick Reference Commands

```bash
# Deploy production
./scripts/deploy-production-optimized.sh

# Check health
./monitoring/health-checks/health-check.sh

# View memory usage
docker stats --format "table {{.Container}}\t{{.MemUsage}}"

# Create backup
./scripts/backup-recovery-system.sh backup full

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart service
docker-compose -f docker-compose.prod.yml restart <service>

# Rollback deployment
./scripts/deploy-production-optimized.sh --rollback
```