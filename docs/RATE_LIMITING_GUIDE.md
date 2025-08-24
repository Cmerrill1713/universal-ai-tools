# Rate Limiting Guide

This guide explains the enhanced rate limiting implementation in Universal AI Tools.

## Overview

The rate limiting middleware provides:
- Token bucket algorithm for fair rate limiting
- Redis support with automatic in-memory fallback
- Per-endpoint configuration
- Standard and legacy header support
- User and IP-based limiting
- Admin controls for monitoring and resetting limits

## Features

### 1. Distributed Rate Limiting
- Uses Redis when available for distributed rate limiting across multiple server instances
- Automatically falls back to in-memory storage if Redis is unavailable
- Seamless switching between Redis and in-memory modes

### 2. Token Bucket Algorithm
- Fair rate limiting that allows burst traffic
- Tokens are refilled continuously over time
- Configurable window size and max requests

### 3. Flexible Configuration
- Global defaults via environment variables
- Per-endpoint custom configurations
- Runtime configuration through middleware options

### 4. Comprehensive Headers
- Standard `RateLimit-*` headers (draft-ietf-httpapi-ratelimit-headers)
- Legacy `X-RateLimit-*` headers for backward compatibility
- `Retry-After` header when rate limit is exceeded

## Configuration

### Environment Variables

```bash
# Default rate limit settings
RATE_LIMIT_WINDOW_MS=60000          # Window size in milliseconds (default: 1 minute)
RATE_LIMIT_MAX_REQUESTS=100         # Max requests per window (default: 100)
RATE_LIMIT_STANDARD_HEADERS=true    # Enable standard headers (default: true)
RATE_LIMIT_LEGACY_HEADERS=true      # Enable legacy headers (default: true)

# Redis configuration (optional)
REDIS_URL=redis://localhost:6379    # Redis connection URL
REDIS_RETRY_ATTEMPTS=3              # Number of retry attempts
```

### Pre-configured Endpoints

The following endpoints have custom rate limits:

| Endpoint | Window | Max Requests | Description |
|----------|--------|--------------|-------------|
| `/api/v1/auth/login` | 15 min | 5 | Prevent brute force attacks |
| `/api/v1/auth/register` | 1 hour | 3 | Limit account creation |
| `/api/v1/orchestration` | 1 min | 30 | Agent orchestration requests |
| `/api/v1/memory` | 1 min | 50 | Memory operations |
| `/api/v1/speech` | 1 min | 20 | Speech synthesis/recognition |
| `/api/v1/knowledge` | 1 min | 40 | Knowledge base queries |

## Usage

### Basic Usage

The rate limiter is automatically applied globally in `server.ts`:

```typescript
// Applied to all routes
app.use(createRateLimiter());
```

### Custom Configuration

Apply custom rate limits to specific endpoints:

```typescript
import { createRateLimiter } from '@/middleware/rate-limiter-enhanced';

// Strict rate limiting for expensive operations
app.post('/api/v1/generate-report',
  createRateLimiter({
    windowMs: 5 * 60 * 1000,  // 5 minutes
    maxRequests: 5,           // 5 requests per 5 minutes
    keyPrefix: 'report'       // Custom key prefix
  }),
  async (req, res) => {
    // Handle request
  }
);
```

### Admin Operations

```typescript
import { resetRateLimit, getRateLimitStatus } from '@/middleware/rate-limiter-enhanced';

// Reset rate limits for a specific user
await resetRateLimit('user123');

// Reset all rate limits
await resetRateLimit();

// Get rate limit status for a user
const status = await getRateLimitStatus('user123');
// Returns: { '/api/v1/memory': { limit: 50, remaining: 35, reset: Date } }
```

## Response Headers

### When Under Limit

```http
HTTP/1.1 200 OK
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 2024-01-20T10:15:00.000Z
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1705749300
```

### When Rate Limited

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 2024-01-20T10:15:00.000Z
Retry-After: 45
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "details": {
      "limit": 100,
      "windowMs": 60000,
      "retryAfter": 45
    }
  }
}
```

## Testing

### Using curl

```bash
# Make multiple requests to test rate limiting
for i in {1..10}; do
  curl -i http://localhost:8080/api/v1/memory
  echo "\n---"
done

# Check rate limit status (requires admin endpoint)
curl http://localhost:8080/api/v1/admin/rate-limit-status/192.168.1.1
```

### Using Node.js

```javascript
// Test rate limiting
async function testRateLimit() {
  const promises = [];
  
  for (let i = 0; i < 150; i++) {
    promises.push(
      fetch('http://localhost:8080/api/v1/memory')
        .then(res => ({
          status: res.status,
          remaining: res.headers.get('RateLimit-Remaining')
        }))
    );
  }
  
  const results = await Promise.all(promises);
  const rateLimited = results.filter(r => r.status === 429);
  
  console.log(`Total requests: ${results.length}`);
  console.log(`Rate limited: ${rateLimited.length}`);
}
```

## Best Practices

1. **Set Appropriate Limits**: Balance between protecting your service and providing good user experience
2. **Use Key Prefixes**: Organize rate limit keys with descriptive prefixes
3. **Monitor Rate Limits**: Use the admin endpoints to monitor rate limit usage
4. **Graceful Degradation**: The system continues to work even if Redis fails
5. **User-Based Limiting**: Authenticated users get their own rate limits (not shared by IP)

## Troubleshooting

### Redis Connection Issues

If you see Redis connection errors in logs:
1. Check if Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` environment variable
3. The system will automatically use in-memory storage as fallback

### Rate Limits Not Working

1. Check if middleware is applied before your routes
2. Verify environment variables are loaded
3. Check logs for any initialization errors
4. Use `getRateLimitStatus` to debug current limits

### Memory Usage

The in-memory store automatically cleans up entries older than 1 hour. If you're concerned about memory usage:
1. Use Redis for production deployments
2. Monitor the size of the in-memory store
3. Adjust cleanup thresholds if needed