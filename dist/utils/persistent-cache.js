import Redis from 'ioredis';
import { log, LogContext } from './logger';
export class PersistentCache {
    keyPrefix;
    defaultTTL;
    redis = null;
    memoryFallback = new Map();
    connected = false;
    constructor(keyPrefix, defaultTTL = 3600) {
        this.keyPrefix = keyPrefix;
        this.defaultTTL = defaultTTL;
        this.initializeRedis();
    }
    async initializeRedis() {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                connectTimeout: 10000,
                commandTimeout: 5000,
                enableOfflineQueue: false,
            });
            await this.redis.connect();
            this.connected = true;
            log.info('✅ Persistent cache connected to Redis', LogContext.SYSTEM, { keyPrefix: this.keyPrefix });
        }
        catch (error) {
            log.warn('⚠️ Redis unavailable, using memory fallback', LogContext.SYSTEM, {
                keyPrefix: this.keyPrefix,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async set(key, value, ttl) {
        const fullKey = `${this.keyPrefix}:${key}`;
        const serialized = JSON.stringify(value);
        const expiryTime = Date.now() + (ttl || this.defaultTTL) * 1000;
        try {
            if (this.connected && this.redis) {
                await this.redis.setex(fullKey, ttl || this.defaultTTL, serialized);
            }
            else {
                this.memoryFallback.set(fullKey, { value, expiry: expiryTime });
                this.cleanupExpired();
            }
        }
        catch (error) {
            log.error('Cache set failed', LogContext.SYSTEM, { key: fullKey, error });
            this.memoryFallback.set(fullKey, { value, expiry: expiryTime });
        }
    }
    async get(key) {
        const fullKey = `${this.keyPrefix}:${key}`;
        try {
            if (this.connected && this.redis) {
                const result = await this.redis.get(fullKey);
                return result ? JSON.parse(result) : null;
            }
            else {
                const cached = this.memoryFallback.get(fullKey);
                if (cached && cached.expiry > Date.now()) {
                    return cached.value;
                }
                return null;
            }
        }
        catch (error) {
            log.error('Cache get failed', LogContext.SYSTEM, { key: fullKey, error });
            return null;
        }
    }
    async delete(key) {
        const fullKey = `${this.keyPrefix}:${key}`;
        try {
            if (this.connected && this.redis) {
                await this.redis.del(fullKey);
            }
            this.memoryFallback.delete(fullKey);
        }
        catch (error) {
            log.error('Cache delete failed', LogContext.SYSTEM, { key: fullKey, error });
        }
    }
    async exists(key) {
        const fullKey = `${this.keyPrefix}:${key}`;
        try {
            if (this.connected && this.redis) {
                return (await this.redis.exists(fullKey)) === 1;
            }
            else {
                const cached = this.memoryFallback.get(fullKey);
                return cached !== undefined && cached.expiry > Date.now();
            }
        }
        catch (error) {
            return false;
        }
    }
    async has(key) {
        return this.exists(key);
    }
    async keys(pattern) {
        const fullPattern = `${this.keyPrefix}:${pattern}`;
        try {
            if (this.connected && this.redis) {
                const keys = await this.redis.keys(fullPattern);
                return keys.map(k => k.replace(`${this.keyPrefix}:`, ''));
            }
            else {
                const keys = [];
                for (const [key, cached] of this.memoryFallback.entries()) {
                    if (key.startsWith(`${this.keyPrefix}:`) && cached.expiry > Date.now()) {
                        const shortKey = key.replace(`${this.keyPrefix}:`, '');
                        if (shortKey.includes(pattern.replace('*', ''))) {
                            keys.push(shortKey);
                        }
                    }
                }
                return keys;
            }
        }
        catch (error) {
            return [];
        }
    }
    cleanupExpired() {
        const now = Date.now();
        for (const [key, cached] of this.memoryFallback.entries()) {
            if (cached.expiry <= now) {
                this.memoryFallback.delete(key);
            }
        }
    }
    async disconnect() {
        if (this.redis) {
            await this.redis.disconnect();
            this.connected = false;
        }
    }
}
export function createPersistentCache(keyPrefix, ttl) {
    return new PersistentCache(keyPrefix, ttl);
}
export default PersistentCache;
//# sourceMappingURL=persistent-cache.js.map