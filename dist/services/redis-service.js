import { createClient } from 'redis';
import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
class RedisService {
    client = null;
    inMemoryCache = new Map();
    isConnectedToRedis = false;
    constructor() {
        this.initializeRedis();
    }
    async initializeRedis() {
        if (!config.redis?.url) {
            log.warn('⚠️ No Redis URL configured, using in-memory fallback', LogContext.SYSTEM);
            return;
        }
        try {
            this.client = createClient({
                url: config.redis.url,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            log.error('❌ Redis connection failed after 10 retries', LogContext.SYSTEM);
                            return false;
                        }
                        return Math.min(retries * 100, 3000);
                    },
                },
            });
            this.client.on('error', (err) => {
                log.error('❌ Redis connection error', LogContext.SYSTEM, { error: err.message });
                this.isConnectedToRedis = false;
            });
            this.client.on('connect', () => {
                log.info('✅ Connected to Redis', LogContext.SYSTEM);
                this.isConnectedToRedis = true;
            });
            this.client.on('ready', () => {
                log.info('✅ Redis ready', LogContext.SYSTEM);
                this.isConnectedToRedis = true;
            });
            await this.client.connect();
        }
        catch (error) {
            log.error('❌ Failed to connect to Redis', LogContext.SYSTEM, { error });
            this.isConnectedToRedis = false;
        }
    }
    async get(key) {
        if (this.client && this.isConnectedToRedis) {
            try {
                const value = await this.client.get(key);
                return value ? JSON.parse(value) : null;
            }
            catch (error) {
                log.error('❌ Redis get error', LogContext.SYSTEM, { error, key });
                return this.inMemoryCache.get(key);
            }
        }
        return this.inMemoryCache.get(key);
    }
    async set(key, value, ttl) {
        if (this.client && this.isConnectedToRedis) {
            try {
                const serializedValue = JSON.stringify(value);
                if (ttl) {
                    await this.client.setEx(key, ttl, serializedValue);
                }
                else {
                    await this.client.set(key, serializedValue);
                }
            }
            catch (error) {
                log.error('❌ Redis set error', LogContext.SYSTEM, { error, key });
                this.setInMemory(key, value, ttl);
            }
        }
        else {
            this.setInMemory(key, value, ttl);
        }
    }
    setInMemory(key, value, ttl) {
        this.inMemoryCache.set(key, value);
        if (ttl) {
            setTimeout(() => {
                this.inMemoryCache.delete(key);
            }, ttl * 1000);
        }
    }
    async del(key) {
        if (this.client && this.isConnectedToRedis) {
            try {
                await this.client.del(key);
            }
            catch (error) {
                log.error('❌ Redis del error', LogContext.SYSTEM, { error, key });
                this.inMemoryCache.delete(key);
            }
        }
        else {
            this.inMemoryCache.delete(key);
        }
    }
    async exists(key) {
        if (this.client && this.isConnectedToRedis) {
            try {
                const result = await this.client.exists(key);
                return result === 1;
            }
            catch (error) {
                log.error('❌ Redis exists error', LogContext.SYSTEM, { error, key });
                return this.inMemoryCache.has(key);
            }
        }
        return this.inMemoryCache.has(key);
    }
    async flushall() {
        if (this.client && this.isConnectedToRedis) {
            try {
                await this.client.flushAll();
            }
            catch (error) {
                log.error('❌ Redis flushall error', LogContext.SYSTEM, { error });
                this.inMemoryCache.clear();
            }
        }
        else {
            this.inMemoryCache.clear();
        }
    }
    isConnected() {
        return this.isConnectedToRedis;
    }
    async ping() {
        if (this.client && this.isConnectedToRedis) {
            try {
                const result = await this.client.ping();
                return result === 'PONG';
            }
            catch (error) {
                log.error('❌ Redis ping error', LogContext.SYSTEM, { error });
                return false;
            }
        }
        return true;
    }
    get isInMemoryMode() {
        return !this.isConnectedToRedis;
    }
    async disconnect() {
        if (this.client) {
            try {
                await this.client.quit();
            }
            catch (error) {
                log.error('❌ Redis disconnect error', LogContext.SYSTEM, { error });
            }
        }
    }
}
export const redisService = new RedisService();
export default redisService;
//# sourceMappingURL=redis-service.js.map