/**
 * Rate Limiting Examples for Universal AI Tools
 * 
 * This file demonstrates various ways to use the enhanced rate limiting middleware
 */

import express from 'express';
import { createRateLimiter, resetRateLimit, getRateLimitStatus } from '@/middleware/rate-limiter-enhanced';

const app = express();

// Example 1: Global rate limiting (already applied in server.ts)
// This is applied to all routes by default

// Example 2: Custom rate limiting for specific endpoints
app.post('/api/v1/expensive-operation', 
  createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10, // 10 requests per 5 minutes
    keyPrefix: 'expensive'
  }),
  async (req, res) => {
    // Your expensive operation here
    res.json({ success: true, message: 'Operation completed' });
  }
);

// Example 3: Stricter rate limiting for sensitive endpoints
app.post('/api/v1/admin/action',
  createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // 5 requests per hour
    keyPrefix: 'admin',
    skipSuccessfulRequests: false, // Count all requests
    skipFailedRequests: false // Count all requests
  }),
  async (req, res) => {
    // Admin action
    res.json({ success: true });
  }
);

// Example 4: More lenient rate limiting for read operations
app.get('/api/v1/public/data',
  createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests per minute
    keyPrefix: 'public-read'
  }),
  async (req, res) => {
    // Return public data
    res.json({ data: [] });
  }
);

// Example 5: Admin endpoint to reset rate limits for a user
app.post('/api/v1/admin/reset-rate-limit/:userId',
  async (req, res) => {
    const { userId } = req.params;
    
    try {
      // Reset rate limit for specific user
      await resetRateLimit(userId);
      
      res.json({
        success: true,
        message: `Rate limit reset for user ${userId}`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to reset rate limit'
      });
    }
  }
);

// Example 6: Admin endpoint to check rate limit status
app.get('/api/v1/admin/rate-limit-status/:identifier',
  async (req, res) => {
    const { identifier } = req.params;
    
    try {
      const status = await getRateLimitStatus(identifier);
      
      if (status) {
        res.json({
          success: true,
          status
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No rate limit data found for this identifier'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit status'
      });
    }
  }
);

// Example 7: Environment variable configuration
/*
You can configure default rate limits via environment variables:

RATE_LIMIT_WINDOW_MS=60000          # Default window in milliseconds (1 minute)
RATE_LIMIT_MAX_REQUESTS=100         # Default max requests per window
RATE_LIMIT_STANDARD_HEADERS=true    # Enable standard RateLimit headers
RATE_LIMIT_LEGACY_HEADERS=true      # Enable legacy X-RateLimit headers

Redis configuration (optional, will use in-memory if not available):
REDIS_URL=redis://localhost:6379
REDIS_RETRY_ATTEMPTS=3
*/

// Example 8: Testing rate limits with curl
/*
# Make requests and observe rate limit headers
curl -i http://localhost:8080/api/v1/memory

# Response headers will include:
# RateLimit-Limit: 50
# RateLimit-Remaining: 49
# RateLimit-Reset: 2024-01-20T10:15:00.000Z
# X-RateLimit-Limit: 50
# X-RateLimit-Remaining: 49
# X-RateLimit-Reset: 1705749300

# When rate limit is exceeded:
# HTTP/1.1 429 Too Many Requests
# Retry-After: 45
# {
#   "success": false,
#   "error": {
#     "code": "RATE_LIMIT_EXCEEDED",
#     "message": "Too many requests, please try again later",
#     "details": {
#       "limit": 50,
#       "windowMs": 60000,
#       "retryAfter": 45
#     }
#   }
# }
*/

export default app;