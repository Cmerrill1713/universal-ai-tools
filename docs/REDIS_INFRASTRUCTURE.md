# Redis Infrastructure Setup Guide

This guide provides comprehensive instructions for setting up Redis infrastructure for the Universal AI Tools platform in both development and production environments.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Configuration](#configuration)
- [Health Monitoring](#health-monitoring)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Overview

Redis is used in Universal AI Tools for:
- **High-performance caching** of AI responses and embeddings
- **Session management** for user authentication
- **Rate limiting** to prevent API abuse
- **Real-time features** via pub/sub
- **Distributed locking** for concurrent operations
- **Queue management** for background jobs

## Architecture

### Components

1. **Redis Service** (`src/services/redis-service.ts`)
   - Connection pooling
   - Automatic reconnection
   - Circuit breaker pattern
   - In-memory fallback cache

2. **Health Monitoring** (`src/services/redis-health-check.ts`)
   - Real-time health status
   - Performance metrics
   - Operation testing
   - Alerting integration

3. **Docker Configuration**
   - Development: `docker-compose.redis.yml`
   - Production: `docker-compose.prod.yml`
   - Configuration: `redis/redis.conf`

### High Availability Features

- **Connection Pooling**: Multiple connections for load distribution
- **Read Replicas**: Optional read scaling
- **Cluster Mode**: Support for Redis Cluster
- **Fallback Cache**: In-memory LRU cache when Redis is unavailable
- **Circuit Breaker**: Prevents cascading failures

## Development Setup

### Quick Start

1. **Using Docker (Recommended)**
   ```bash
   # Start Redis with Docker Compose
   docker-compose -f docker-compose.redis.yml up -d
   
   # Or use the initialization script
   ./scripts/init-redis.sh
   ```

2. **Local Installation**
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Ubuntu/Debian
   sudo apt-get install redis-server
   sudo systemctl start redis
   ```

3. **Verify Setup**
   ```bash
   # Test Redis connection
   npm run test:redis
   
   # Or manually
   redis-cli ping
   # Should return: PONG
   ```

### Development Configuration

Add to `.env`:
```env
# Basic Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Connection Pool
REDIS_POOL_SIZE=5
REDIS_CONNECTION_TIMEOUT=5000
REDIS_COMMAND_TIMEOUT=5000

# Features
REDIS_ENABLE_OFFLINE_QUEUE=true
REDIS_ENABLE_AUTORESYNC=true
```

## Production Setup

### Prerequisites

- Docker and Docker Compose installed
- Sufficient memory (minimum 2GB recommended)
- Persistent storage for data persistence
- Network security configured

### Deployment Steps

1. **Generate Secure Password**
   ```bash
   export REDIS_PASSWORD=$(openssl rand -base64 32)
   echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env.production
   ```

2. **Start Redis Infrastructure**
   ```bash
   # Using production script
   ./scripts/start-redis-production.sh
   
   # Or manually with Docker Compose
   docker-compose -f docker-compose.prod.yml up -d redis
   ```

3. **Configure Persistence**
   ```bash
   # Redis configuration is in redis/redis.conf
   # Key settings:
   # - AOF persistence enabled
   # - RDB snapshots configured
   # - Maximum memory policy set
   ```

4. **Set Up Monitoring**
   ```bash
   # Start Prometheus and Grafana
   docker-compose -f docker-compose.prod.yml up -d prometheus grafana
   ```

### Production Configuration

```env
# Security
REDIS_PASSWORD=your-secure-password-here
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379

# Performance
REDIS_POOL_SIZE=10
REDIS_MAX_MEMORY=2gb
REDIS_MAX_CLIENTS=10000

# High Availability (Optional)
REDIS_CLUSTER_MODE=false
REDIS_READ_REPLICAS=false
REDIS_READ_REPLICA_URLS=
REDIS_CLUSTER_NODES=
```

## Configuration

### Redis Configuration File

Key settings in `redis/redis.conf`:

```conf
# Memory Management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000

# Security
requirepass ${REDIS_PASSWORD}
protected-mode yes

# Performance
tcp-backlog 511
tcp-keepalive 300
io-threads 4
io-threads-do-reads yes
```

### Environment Variables

| Variable | Description | Default | Production |
|----------|-------------|---------|------------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | Required |
| `REDIS_PASSWORD` | Redis password | None | Required |
| `REDIS_POOL_SIZE` | Connection pool size | 5 | 10-20 |
| `REDIS_CONNECTION_TIMEOUT` | Connection timeout (ms) | 5000 | 10000 |
| `REDIS_COMMAND_TIMEOUT` | Command timeout (ms) | 5000 | 5000 |
| `REDIS_MAX_MEMORY` | Maximum memory usage | 2gb | 2-8gb |
| `REDIS_CLUSTER_MODE` | Enable cluster mode | false | Optional |
| `REDIS_READ_REPLICAS` | Enable read replicas | false | Optional |

## Health Monitoring

### Automatic Health Checks

The system performs periodic health checks every 30 seconds:

```typescript
// Health check includes:
- Connection status
- Response latency
- Memory usage
- Connected clients
- Uptime monitoring
- Fallback cache status
```

### Manual Health Check

```bash
# Using the API
curl http://localhost:9999/api/health

# Using the test script
npm run test:redis

# Direct Redis check
redis-cli ping
redis-cli info stats
```

### Monitoring Endpoints

- `/api/health` - Overall system health including Redis
- `/api/health/redis` - Detailed Redis health status
- `/metrics` - Prometheus metrics

## Testing

### Run All Tests

```bash
# Comprehensive test suite
npm run test:redis

# Or using the script directly
./scripts/test-redis-setup.ts
```

### Test Categories

1. **Connection Tests**
   - Basic connectivity
   - Authentication
   - Connection pooling

2. **Operation Tests**
   - Basic operations (GET, SET, DEL)
   - Advanced operations (MSET, HSET, Lists)
   - Transaction support

3. **Performance Tests**
   - Throughput testing
   - Latency measurements
   - Concurrent operations

4. **Resilience Tests**
   - Circuit breaker functionality
   - Fallback cache operations
   - Reconnection logic

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if Redis is running
   docker ps | grep redis
   
   # Check Redis logs
   docker logs universal-ai-tools-redis
   
   # Verify port availability
   lsof -i :6379
   ```

2. **Authentication Failed**
   ```bash
   # Verify password in environment
   echo $REDIS_PASSWORD
   
   # Test with redis-cli
   redis-cli -a $REDIS_PASSWORD ping
   ```

3. **High Memory Usage**
   ```bash
   # Check memory stats
   redis-cli info memory
   
   # Monitor in real-time
   redis-cli --stat
   
   # Adjust maxmemory if needed
   redis-cli CONFIG SET maxmemory 4gb
   ```

4. **Slow Performance**
   ```bash
   # Check slow log
   redis-cli SLOWLOG GET 10
   
   # Monitor latency
   redis-cli --latency
   
   # Check client connections
   redis-cli CLIENT LIST
   ```

### Debug Commands

```bash
# View all configuration
redis-cli CONFIG GET "*"

# Monitor commands in real-time
redis-cli MONITOR

# Check persistence status
redis-cli INFO persistence

# Test specific operations
redis-cli --latency-history
redis-cli --bigkeys
```

## Best Practices

### Security

1. **Always use strong passwords in production**
   ```bash
   openssl rand -base64 32
   ```

2. **Enable protected mode**
   ```conf
   protected-mode yes
   ```

3. **Disable dangerous commands**
   ```conf
   rename-command FLUSHDB ""
   rename-command FLUSHALL ""
   rename-command KEYS ""
   ```

4. **Use SSL/TLS for remote connections**

### Performance

1. **Use connection pooling**
   - Set appropriate pool size based on load
   - Monitor connection usage

2. **Implement proper key naming**
   ```
   namespace:type:id
   cache:user:12345
   session:web:abc123
   ```

3. **Set appropriate TTLs**
   - AI responses: 1 hour
   - Sessions: 24 hours
   - Rate limits: 15 minutes

4. **Monitor memory usage**
   - Set up alerts for high memory
   - Use eviction policies appropriately

### Reliability

1. **Enable persistence**
   - AOF for durability
   - RDB for backups

2. **Set up replication** (for production)
   ```bash
   # Master configuration
   bind 0.0.0.0
   protected-mode no
   
   # Replica configuration
   replicaof master_ip 6379
   masterauth your_password
   ```

3. **Implement circuit breakers**
   - Prevents cascade failures
   - Automatic fallback to in-memory cache

4. **Regular backups**
   ```bash
   # Manual backup
   redis-cli BGSAVE
   
   # Automated backup script
   0 2 * * * docker exec universal-ai-tools-redis redis-cli BGSAVE
   ```

### Monitoring

1. **Set up alerts for:**
   - Connection failures
   - High memory usage (>80%)
   - Slow queries (>100ms)
   - Replication lag

2. **Use Grafana dashboards**
   - Import Redis dashboard
   - Configure alerts

3. **Log analysis**
   - Regular review of slow log
   - Monitor error patterns

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review slow query log
   - Check memory fragmentation
   - Verify backup integrity

2. **Monthly**
   - Analyze key patterns
   - Review and optimize memory usage
   - Update Redis version if needed

3. **Quarterly**
   - Performance testing
   - Security audit
   - Capacity planning

### Upgrade Process

1. **Test in development first**
2. **Backup all data**
3. **Plan maintenance window**
4. **Use rolling updates for zero downtime**

## Resources

- [Redis Documentation](https://redis.io/documentation)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Redis Security](https://redis.io/topics/security)
- [Redis Performance](https://redis.io/topics/optimization)