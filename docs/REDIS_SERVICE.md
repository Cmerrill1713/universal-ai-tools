# Redis Service Implementation

## Overview

The Redis service provides a production-ready Redis connection management system with:
- Connection pooling for optimal resource utilization
- Circuit breaker pattern for fault tolerance
- In-memory fallback cache using LRU eviction
- Support for Redis Cluster mode
- Read replica support for read scaling
- Comprehensive error handling and retry logic

## Features

### 1. Connection Pooling
- Configurable pool size via `REDIS_POOL_SIZE` environment variable
- Round-robin connection selection for load distribution
- Automatic connection health monitoring
- Graceful connection cleanup on shutdown

### 2. Circuit Breaker Pattern
- Prevents cascading failures when Redis is unavailable
- Automatic circuit opening after error threshold
- Configurable timeout and retry settings
- Fallback to in-memory cache when circuit is open

### 3. In-Memory Fallback Cache
- LRU (Least Recently Used) eviction policy
- 100MB maximum size by default
- TTL support for cache entries
- Seamless fallback when Redis is unavailable

### 4. Cluster Mode Support
- Automatic node discovery
- Failover handling
- Slot-based routing
- Configurable via `REDIS_CLUSTER_MODE=true`

### 5. Read Replica Support
- Separate read replicas for read scaling
- Random replica selection for load distribution
- Automatic failover to primary if replicas fail
- Configure via `REDIS_READ_REPLICA_URLS` (comma-separated)

## Configuration

### Environment Variables

```bash
# Basic Configuration
REDIS_URL=redis://localhost:6379          # Redis connection URL
REDIS_POOL_SIZE=5                         # Connection pool size (default: 5)

# Cluster Mode
REDIS_CLUSTER_MODE=true                   # Enable cluster mode
REDIS_CLUSTER_NODES=redis://node1:6379,redis://node2:6379  # Cluster nodes

# Read Replicas
REDIS_READ_REPLICAS=true                  # Enable read replicas
REDIS_READ_REPLICA_URLS=redis://replica1:6379,redis://replica2:6379

# Advanced Options
REDIS_CONNECT_TIMEOUT=10000               # Connection timeout in ms
REDIS_COMMAND_TIMEOUT=5000                # Command timeout in ms
REDIS_MAX_RETRIES=3                       # Max retries per request
REDIS_ENABLE_AUTO_PIPELINING=true         # Enable auto pipelining
```

## Usage

### Basic Usage

```typescript
import { getRedisService } from './services/redis-service';

const redisService = getRedisService();

// Connect to Redis
await redisService.connect();

// Basic operations
await redisService.set('key', 'value', 300); // 5 minute TTL
const value = await redisService.get('key');

// Batch operations
await redisService.mset({
  'key1': 'value1',
  'key2': 'value2'
});

const values = await redisService.mget(['key1', 'key2']);

// Hash operations
await redisService.hset('hash', 'field', 'value');
const hashValue = await redisService.hget('hash', 'field');

// List operations
await redisService.lpush('list', 'item1', 'item2');
const items = await redisService.lrange('list', 0, -1);
```

### Health Monitoring

```typescript
// Check health
const health = await redisService.healthCheck();
console.log(health); // { healthy: true, latency: 2 }

// Get statistics
const stats = await redisService.getStats();
console.log(stats);
// {
//   connected: true,
//   connectionAttempts: 1,
//   memoryUsage: '10.5M',
//   connectedClients: 5,
//   uptime: 3600
// }

// Fallback cache stats
const fallbackStats = redisService.getFallbackCacheStats();
console.log(fallbackStats);
// {
//   size: 10000,
//   calculatedSize: 1048576,
//   itemCount: 150
// }
```

### Circuit Breaker Integration

The Redis service automatically integrates with the circuit breaker service:

```typescript
// Operations are automatically wrapped with circuit breaker
const value = await redisService.get('key');
// If Redis fails multiple times, circuit opens and fallback cache is used

// Monitor circuit breaker status
import { circuitBreaker } from './services/circuit-breaker';

const metrics = circuitBreaker.getMetrics('redis-get');
console.log(metrics);
// {
//   state: 'closed',
//   requests: 1000,
//   failures: 2,
//   successes: 998,
//   rejects: 0,
//   timeouts: 0,
//   fallbacks: 2
// }
```

## Fallback Cache Behavior

When Redis is unavailable, the service automatically falls back to an in-memory LRU cache:

1. **Write Operations**: Data is stored in the fallback cache with optional TTL
2. **Read Operations**: Data is retrieved from the fallback cache if available
3. **TTL Support**: The fallback cache respects TTL settings
4. **Size Limits**: Cache is limited to 100MB by default
5. **Eviction**: LRU policy evicts least recently used items when full

## Production Considerations

### 1. Connection Pool Sizing
- Set pool size based on concurrent connections needed
- Monitor connection usage and adjust accordingly
- Default of 5 connections is suitable for most applications

### 2. Circuit Breaker Tuning
- Adjust error threshold based on tolerance
- Set appropriate timeout values
- Monitor circuit breaker metrics

### 3. Fallback Cache Sizing
- Consider memory constraints when sizing fallback cache
- Monitor cache hit/miss ratios
- Clear cache periodically if needed

### 4. Monitoring
- Track connection health and latency
- Monitor circuit breaker state changes
- Alert on persistent Redis failures
- Track fallback cache usage

### 5. Security
- Use strong passwords in production
- Enable TLS for Redis connections
- Restrict network access to Redis
- Regularly update Redis version

## Troubleshooting

### Connection Issues
```bash
# Check Redis connectivity
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker logs redis-container

# Test with service
npm run test:redis
```

### Performance Issues
- Enable auto-pipelining for batch operations
- Use read replicas for read-heavy workloads
- Monitor slow queries in Redis
- Check network latency

### Circuit Breaker Issues
- Check circuit breaker metrics
- Verify error thresholds are appropriate
- Monitor fallback execution rates
- Check timeout settings

## Migration from Mock to Real Redis

1. **Install Redis locally or use managed service**
2. **Set REDIS_URL environment variable**
3. **Run connection test**: `npm run test:redis`
4. **Monitor initial performance**
5. **Tune configuration as needed**

## Best Practices

1. **Always handle connection errors gracefully**
2. **Set appropriate TTLs for cached data**
3. **Monitor memory usage in both Redis and fallback cache**
4. **Use read replicas for read-heavy workloads**
5. **Implement proper key naming conventions**
6. **Regular backup of Redis data in production**
7. **Use Redis persistence for critical data**
8. **Monitor and alert on circuit breaker state changes**