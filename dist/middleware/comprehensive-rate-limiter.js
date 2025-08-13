import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
export class ComprehensiveRateLimiter {
    store = new Map();
    rules = [];
    globalConfig;
    cleanupInterval;
    constructor(globalConfig) {
        this.globalConfig = globalConfig;
        this.startCleanup();
    }
    addRule(rule) {
        this.rules.push(rule);
        log.info('📋 Rate limit rule added', LogContext.API, {
            path: rule.path.toString(),
            method: rule.method || 'ALL',
            maxRequests: rule.config.maxRequests,
            windowMs: rule.config.windowMs,
        });
    }
    middleware() {
        return async (req, res, next) => {
            try {
                const config = this.getConfigForRequest(req);
                if (config.skipIf && config.skipIf(req)) {
                    return next();
                }
                const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
                const clientData = this.getClientData(key);
                const now = Date.now();
                if (now - clientData.lastReset > config.windowMs) {
                    clientData.requests = [];
                    clientData.lastReset = now;
                }
                const windowStart = now - config.windowMs;
                clientData.requests = clientData.requests.filter(time => time > windowStart);
                if (clientData.requests.length >= config.maxRequests) {
                    const penalty = this.calculatePenalty(clientData);
                    if (config.onLimitReached) {
                        config.onLimitReached(req, res);
                    }
                    const retryAfter = Math.ceil((config.windowMs - (now - Math.min(...clientData.requests))) / 1000) + penalty;
                    res.setHeader('Retry-After', retryAfter.toString());
                    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
                    res.setHeader('X-RateLimit-Remaining', '0');
                    res.setHeader('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());
                    log.warn('🚫 Rate limit exceeded', LogContext.API, {
                        key,
                        path: req.path,
                        method: req.method,
                        requests: clientData.requests.length,
                        limit: config.maxRequests,
                        windowMs: config.windowMs,
                        retryAfter,
                    });
                    clientData.consecutiveFailures++;
                    clientData.lastFailure = now;
                    return sendError(res, 'RATE_LIMIT_EXCEEDED', `Rate limit exceeded. Try again in ${retryAfter} seconds.`, 429);
                }
                clientData.requests.push(now);
                clientData.consecutiveFailures = 0;
                const remaining = Math.max(0, config.maxRequests - clientData.requests.length);
                res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
                res.setHeader('X-RateLimit-Remaining', remaining.toString());
                res.setHeader('X-RateLimit-Reset', new Date(clientData.lastReset + config.windowMs).toISOString());
                this.store.set(key, clientData);
                next();
            }
            catch (error) {
                log.error('Rate limiter error', LogContext.API, { error });
                next();
            }
        };
    }
    getConfigForRequest(req) {
        for (const rule of this.rules) {
            if (this.matchesRule(req, rule)) {
                return rule.config;
            }
        }
        return this.globalConfig;
    }
    matchesRule(req, rule) {
        const pathMatches = rule.path instanceof RegExp
            ? rule.path.test(req.path)
            : req.path.startsWith(rule.path);
        if (!pathMatches)
            return false;
        if (rule.method) {
            const methods = Array.isArray(rule.method) ? rule.method : [rule.method];
            if (!methods.includes(req.method))
                return false;
        }
        return true;
    }
    getClientData(key) {
        if (!this.store.has(key)) {
            this.store.set(key, {
                requests: [],
                lastReset: Date.now(),
                consecutiveFailures: 0,
                lastFailure: 0,
            });
        }
        return this.store.get(key);
    }
    getDefaultKey(req) {
        if (req.user?.id) {
            return `user:${req.user.id}`;
        }
        return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
    }
    calculatePenalty(clientData) {
        if (clientData.consecutiveFailures === 0)
            return 0;
        const basePenalty = Math.min(clientData.consecutiveFailures * 2, 60);
        const timeSinceLastFailure = Date.now() - clientData.lastFailure;
        if (timeSinceLastFailure > 60000) {
            return Math.floor(basePenalty / 2);
        }
        return basePenalty;
    }
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const maxAge = Math.max(this.globalConfig.windowMs, 3600000);
            for (const [key, data] of this.store.entries()) {
                if (now - data.lastReset > maxAge && data.requests.length === 0) {
                    this.store.delete(key);
                }
            }
            log.debug('Rate limiter cleanup completed', LogContext.API, {
                activeClients: this.store.size,
            });
        }, 300000);
    }
    getStats() {
        return {
            activeClients: this.store.size,
            totalRules: this.rules.length,
            memoryUsage: JSON.stringify(Array.from(this.store.entries())).length,
        };
    }
    reset(key) {
        return this.store.delete(key);
    }
    resetAll() {
        this.store.clear();
        log.info('🔄 All rate limits reset', LogContext.API);
    }
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.store.clear();
        log.info('🛑 Rate limiter shutdown complete', LogContext.API);
    }
}
export const createStandardRateLimiter = () => {
    const limiter = new ComprehensiveRateLimiter({
        windowMs: 15 * 60 * 1000,
        maxRequests: 1000,
    });
    limiter.addRule({
        path: '/api/',
        config: {
            windowMs: 15 * 60 * 1000,
            maxRequests: 500,
        },
    });
    limiter.addRule({
        path: '/api/v1/auth',
        config: {
            windowMs: 5 * 60 * 1000,
            maxRequests: 10,
        },
    });
    limiter.addRule({
        path: /^\/api\/v1\/(vision|agents|chat|parameters)/,
        config: {
            windowMs: 10 * 60 * 1000,
            maxRequests: 100,
        },
    });
    limiter.addRule({
        path: /^\/api\/v1\/(health|status|metrics)/,
        config: {
            windowMs: 1 * 60 * 1000,
            maxRequests: 100,
            skipSuccessfulRequests: true,
        },
    });
    return limiter;
};
export const standardRateLimiter = createStandardRateLimiter();
export default ComprehensiveRateLimiter;
//# sourceMappingURL=comprehensive-rate-limiter.js.map