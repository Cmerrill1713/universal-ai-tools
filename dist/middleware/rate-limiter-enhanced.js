import Redis from 'ioredis';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
const MILLISECONDS_IN_SECOND = 1000;
const rateLimitDefaults = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    keyPrefix: 'rate-limit',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    standardHeaders: process.env.RATE_LIMIT_STANDARD_HEADERS !== 'false',
    legacyHeaders: process.env.RATE_LIMIT_LEGACY_HEADERS !== 'false',
};
const endpointConfigs = {
    '/api/v1/auth/login': {
        windowMs: 15 * 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 5,
        keyPrefix: 'auth:login',
    },
    '/api/v1/auth/register': {
        windowMs: 60 * 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 3,
        keyPrefix: 'auth:register',
    },
    '/api/v1/orchestration': {
        windowMs: 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 30,
        keyPrefix: 'orchestration',
    },
    '/api/v1/memory': {
        windowMs: 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 50,
        keyPrefix: 'memory',
    },
    '/api/v1/speech': {
        windowMs: 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 20,
        keyPrefix: 'speech',
    },
    '/api/v1/knowledge': {
        windowMs: 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 40,
        keyPrefix: 'knowledge',
    },
    '/api/v1/assistant/': {
        windowMs: 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 60,
        keyPrefix: 'assistant',
    },
    '/api/v1/agents/': {
        windowMs: 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 30,
        keyPrefix: 'agents',
    },
    '/api/v1/external-apis/': {
        windowMs: 60 * MILLISECONDS_IN_SECOND,
        maxRequests: 60,
        keyPrefix: 'external',
    },
};
class RateLimiter {
    redis = null;
    inMemoryStore = new Map();
    useRedis = false;
    constructor() {
        this.initializeRedis();
    }
    initializeRedis() {
        if (config.redis?.url) {
            try {
                this.redis = new Redis(config.redis.url, {
                    retryStrategy: (times) => {
                        if (times > (config.redis?.retryAttempts || 3)) {
                            log.error('Redis connection failed, falling back to in-memory rate limiting', LogContext.API);
                            this.useRedis = false;
                            return null;
                        }
                        return Math.min(times * 50, 2000);
                    },
                    reconnectOnError: (err) => {
                        const targetError = 'READONLY';
                        if (err.message.includes(targetError)) {
                            return true;
                        }
                        return false;
                    },
                });
                this.redis.on('connect', () => {
                    this.useRedis = true;
                    log.info('Redis connected for rate limiting', LogContext.API);
                });
                this.redis.on('error', (err) => {
                    log.error('Redis error in rate limiter', LogContext.API, { error: err.message });
                    this.useRedis = false;
                });
            }
            catch (error) {
                log.error('Failed to initialize Redis for rate limiting', LogContext.API, { error });
                this.useRedis = false;
            }
        }
        else {
            log.info('Redis not configured, using in-memory rate limiting', LogContext.API);
        }
    }
    getKey(req, keyPrefix) {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const userId = req.user?.id;
        const prefix = keyPrefix || 'rate-limit';
        const identifier = userId || ip;
        return `${prefix}:${identifier}`;
    }
    async getTokenBucket(key, config) {
        const now = Date.now();
        if (this.useRedis && this.redis) {
            try {
                const data = await this.redis.get(key);
                if (data) {
                    const bucket = JSON.parse(data);
                    return this.refillTokens(bucket, config, now);
                }
            }
            catch (error) {
                log.error('Redis error getting token bucket', LogContext.API, { error, key });
            }
        }
        else {
            const bucket = this.inMemoryStore.get(key);
            if (bucket) {
                return this.refillTokens(bucket, config, now);
            }
        }
        return {
            tokens: config.maxRequests,
            lastRefill: now,
        };
    }
    refillTokens(bucket, config, now) {
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor((timePassed * config.maxRequests) / config.windowMs);
        if (tokensToAdd > 0) {
            bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
            bucket.lastRefill = now;
        }
        return bucket;
    }
    async saveTokenBucket(key, bucket, config) {
        if (this.useRedis && this.redis) {
            try {
                const ttl = Math.ceil(config.windowMs / MILLISECONDS_IN_SECOND);
                await this.redis.setex(key, ttl, JSON.stringify(bucket));
            }
            catch (error) {
                log.error('Redis error saving token bucket', LogContext.API, { error, key });
            }
        }
        this.inMemoryStore.set(key, bucket);
        if (this.inMemoryStore.size > 10000) {
            this.cleanupInMemoryStore();
        }
    }
    cleanupInMemoryStore() {
        const now = Date.now();
        const entries = Array.from(this.inMemoryStore.entries());
        entries.forEach(([key, bucket]) => {
            if (now - bucket.lastRefill > 3600000) {
                this.inMemoryStore.delete(key);
            }
        });
    }
    getRateLimitInfo(bucket, config) {
        const now = Date.now();
        const windowEnd = bucket.lastRefill + config.windowMs;
        const msUntilReset = Math.max(0, windowEnd - now);
        return {
            limit: config.maxRequests,
            remaining: Math.max(0, bucket.tokens),
            reset: new Date(windowEnd),
            retryAfter: bucket.tokens <= 0 ? Math.ceil(msUntilReset / MILLISECONDS_IN_SECOND) : undefined,
        };
    }
    setHeaders(res, info, config) {
        if (config.standardHeaders !== false) {
            res.setHeader('RateLimit-Limit', info.limit);
            res.setHeader('RateLimit-Remaining', info.remaining);
            res.setHeader('RateLimit-Reset', info.reset.toISOString());
        }
        if (config.legacyHeaders !== false) {
            res.setHeader('X-RateLimit-Limit', info.limit);
            res.setHeader('X-RateLimit-Remaining', info.remaining);
            res.setHeader('X-RateLimit-Reset', Math.floor(info.reset.getTime() / MILLISECONDS_IN_SECOND));
        }
        if (info.retryAfter !== undefined) {
            res.setHeader('Retry-After', info.retryAfter);
        }
    }
    middleware(customConfig) {
        return async (req, res, next) => {
            try {
                const endpoint = req.path;
                let baseConfig = endpointConfigs[endpoint];
                if (!baseConfig) {
                    let bestKey = '';
                    for (const key of Object.keys(endpointConfigs)) {
                        if (endpoint.startsWith(key) && key.length > bestKey.length) {
                            bestKey = key;
                        }
                    }
                    baseConfig = bestKey ? endpointConfigs[bestKey] : rateLimitDefaults;
                }
                const ensuredBase = baseConfig || rateLimitDefaults;
                const config = {
                    ...ensuredBase,
                    ...customConfig,
                    windowMs: (customConfig?.windowMs ?? ensuredBase.windowMs),
                    maxRequests: (customConfig?.maxRequests ?? ensuredBase.maxRequests),
                };
                const key = this.getKey(req, config.keyPrefix);
                const bucket = await this.getTokenBucket(key, config);
                const info = this.getRateLimitInfo(bucket, config);
                this.setHeaders(res, info, config);
                if (bucket.tokens <= 0) {
                    log.warn('Rate limit exceeded', LogContext.API, {
                        key,
                        endpoint,
                        ip: req.ip,
                        userId: req.user?.id,
                    });
                    res.status(429).json({
                        success: false,
                        error: {
                            code: 'RATE_LIMIT_EXCEEDED',
                            message: 'Too many requests, please try again later',
                            details: {
                                limit: info.limit,
                                windowMs: config.windowMs,
                                retryAfter: info.retryAfter,
                            },
                        },
                    });
                    return;
                }
                bucket.tokens--;
                await this.saveTokenBucket(key, bucket, config);
                res.setHeader('RateLimit-Remaining', Math.max(0, bucket.tokens));
                if (config.legacyHeaders !== false) {
                    res.setHeader('X-RateLimit-Remaining', Math.max(0, bucket.tokens));
                }
                next();
            }
            catch (error) {
                log.error('Rate limiter error', LogContext.API, { error });
                next();
            }
        };
    }
    async reset(identifier) {
        if (identifier) {
            const pattern = `*:${identifier}`;
            if (this.useRedis && this.redis) {
                try {
                    const keys = await this.redis.keys(pattern);
                    if (keys.length > 0) {
                        await this.redis.del(...keys);
                    }
                }
                catch (error) {
                    log.error('Redis error resetting rate limit', LogContext.API, { error, identifier });
                }
            }
            Array.from(this.inMemoryStore.keys())
                .filter((key) => key.includes(identifier))
                .forEach((key) => this.inMemoryStore.delete(key));
        }
        else {
            if (this.useRedis && this.redis) {
                try {
                    await this.redis.flushdb();
                }
                catch (error) {
                    log.error('Redis error flushing rate limits', LogContext.API, { error });
                }
            }
            this.inMemoryStore.clear();
        }
    }
    async getStatus(identifier) {
        const status = {};
        try {
            for (const [endpoint, endpointConfig] of Object.entries(endpointConfigs)) {
                const key = `${endpointConfig.keyPrefix || 'rate-limit'}:${identifier}`;
                const bucket = await this.getTokenBucket(key, endpointConfig);
                if (bucket.lastRefill > 0) {
                    status[endpoint] = this.getRateLimitInfo(bucket, endpointConfig);
                }
            }
            return Object.keys(status).length > 0 ? status : null;
        }
        catch (error) {
            log.error('Error getting rate limit status', LogContext.API, { error, identifier });
            return null;
        }
    }
}
const rateLimiter = new RateLimiter();
export const createRateLimiter = (config) => {
    return rateLimiter.middleware(config);
};
export const resetRateLimit = rateLimiter.reset.bind(rateLimiter);
export const getRateLimitStatus = rateLimiter.getStatus.bind(rateLimiter);
export default createRateLimiter();
//# sourceMappingURL=rate-limiter-enhanced.js.map