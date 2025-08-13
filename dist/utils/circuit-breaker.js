import { log, LogContext } from './logger';
export var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
export class CircuitBreaker {
    name;
    options;
    state = CircuitState.CLOSED;
    failureCount = 0;
    successCount = 0;
    lastFailureTime;
    nextAttempt;
    lastError;
    metrics;
    requestTimestamps = [];
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this.options = {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 60000,
            volumeThreshold: 10,
            errorThresholdPercentage: 50,
            rollingWindow: 60000,
            ...options,
        };
        this.metrics = {
            totalRequests: 0,
            failedRequests: 0,
            successfulRequests: 0,
            rejectedRequests: 0,
            state: this.state,
            errorRate: 0,
            consecutiveFailures: 0,
        };
    }
    async execute(operation, fallback) {
        if (this.state === CircuitState.OPEN) {
            if (this.nextAttempt && Date.now() < this.nextAttempt) {
                this.metrics.rejectedRequests++;
                log.warn(`⚡ Circuit breaker OPEN for ${this.name}`, LogContext.SYSTEM, {
                    nextAttempt: new Date(this.nextAttempt).toISOString(),
                    metrics: this.getMetrics(),
                });
                if (fallback) {
                    return fallback();
                }
                throw new Error(`Circuit breaker is OPEN for ${this.name}`);
            }
            this.state = CircuitState.HALF_OPEN;
            log.info(`🔄 Circuit breaker HALF-OPEN for ${this.name}`, LogContext.SYSTEM);
        }
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure(error);
            if (fallback && this.state !== CircuitState.CLOSED) {
                log.info(`🔄 Using fallback for ${this.name}`, LogContext.SYSTEM);
                return fallback();
            }
            throw error;
        }
    }
    onSuccess() {
        this.metrics.totalRequests++;
        this.metrics.successfulRequests++;
        this.recordRequest(true);
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.options.successThreshold) {
                this.state = CircuitState.CLOSED;
                this.failureCount = 0;
                this.successCount = 0;
                log.info(`✅ Circuit breaker CLOSED for ${this.name}`, LogContext.SYSTEM, {
                    metrics: this.getMetrics(),
                });
            }
        }
        else {
            this.failureCount = 0;
            this.metrics.consecutiveFailures = 0;
        }
        this.metrics.lastSuccessTime = Date.now();
        this.updateMetrics();
    }
    onFailure(error) {
        this.metrics.totalRequests++;
        this.metrics.failedRequests++;
        this.metrics.consecutiveFailures = this.failureCount + 1;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.lastError = errorMessage;
        this.metrics.lastError = errorMessage;
        this.recordRequest(false, errorMessage);
        this.lastFailureTime = Date.now();
        this.metrics.lastFailureTime = this.lastFailureTime;
        if (this.state === CircuitState.HALF_OPEN) {
            this.openCircuit();
        }
        else if (this.state === CircuitState.CLOSED) {
            this.failureCount++;
            const shouldOpenByCount = this.failureCount >= this.options.failureThreshold;
            const shouldOpenByPercentage = this.shouldOpenByErrorRate();
            if (shouldOpenByCount || shouldOpenByPercentage) {
                this.openCircuit();
            }
        }
        this.updateMetrics();
    }
    openCircuit() {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.options.timeout;
        this.successCount = 0;
        log.error(`❌ Circuit breaker OPEN for ${this.name}`, LogContext.SYSTEM, {
            failureCount: this.failureCount,
            nextAttempt: new Date(this.nextAttempt).toISOString(),
            metrics: this.getMetrics(),
        });
    }
    recordRequest(success, error) {
        const now = Date.now();
        this.requestTimestamps.push({ time: now, success, error });
        const cutoff = now - this.options.rollingWindow;
        this.requestTimestamps = this.requestTimestamps.filter((r) => r.time > cutoff);
    }
    shouldOpenByErrorRate() {
        if (this.requestTimestamps.length < this.options.volumeThreshold) {
            return false;
        }
        const recentRequests = this.requestTimestamps.filter((r) => r.time > Date.now() - this.options.rollingWindow);
        if (recentRequests.length === 0)
            return false;
        const errorCount = recentRequests.filter((r) => !r.success).length;
        const errorRate = (errorCount / recentRequests.length) * 100;
        return errorRate >= this.options.errorThresholdPercentage;
    }
    updateMetrics() {
        const recentRequests = this.requestTimestamps.filter((r) => r.time > Date.now() - this.options.rollingWindow);
        const errorCount = recentRequests.filter((r) => !r.success).length;
        const errorRate = recentRequests.length > 0 ? (errorCount / recentRequests.length) * 100 : 0;
        this.metrics.state = this.state;
        this.metrics.errorRate = errorRate;
        this.metrics.consecutiveFailures = this.state === CircuitState.CLOSED ? 0 : this.failureCount;
    }
    getState() {
        return this.state;
    }
    getMetrics() {
        const recentRequests = this.requestTimestamps.filter((r) => r.time > Date.now() - this.options.rollingWindow);
        const metrics = {
            ...this.metrics,
            nextRetryTime: this.nextAttempt,
            rollingWindowMetrics: {
                windowSize: this.options.rollingWindow,
                requestsInWindow: recentRequests.length,
                errorsInWindow: recentRequests.filter((r) => !r.success).length,
            },
        };
        return metrics;
    }
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = undefined;
        this.nextAttempt = undefined;
        this.requestTimestamps = [];
        this.metrics = {
            totalRequests: 0,
            failedRequests: 0,
            successfulRequests: 0,
            rejectedRequests: 0,
            state: this.state,
            errorRate: 0,
            consecutiveFailures: 0,
        };
        log.info(`🔄 Circuit breaker reset for ${this.name}`, LogContext.SYSTEM);
    }
    trip() {
        this.openCircuit();
    }
    close() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        log.info(`✅ Circuit breaker manually closed for ${this.name}`, LogContext.SYSTEM);
    }
    recordFailure() {
        this.onFailure(new Error('Manual failure recorded'));
    }
    getFailureCount() {
        return this.failureCount;
    }
    getLastFailureTime() {
        return this.lastFailureTime;
    }
}
export function createCircuitBreaker(name, options) {
    return new CircuitBreaker(name, options);
}
export class CircuitBreakerRegistry {
    static breakers = new Map();
    static register(name, breaker) {
        this.breakers.set(name, breaker);
    }
    static get(name) {
        return this.breakers.get(name);
    }
    static getAll() {
        return new Map(this.breakers);
    }
    static getMetrics() {
        const entries = [];
        this.breakers.forEach((breaker, name) => {
            entries.push([name, breaker.getMetrics()]);
        });
        return Object.fromEntries(entries);
    }
    static reset(name) {
        if (name) {
            this.breakers.get(name)?.reset();
        }
        else {
            this.breakers.forEach((breaker) => breaker.reset());
        }
    }
}
export function getCircuitBreakerStatus() {
    return CircuitBreakerRegistry.getMetrics();
}
//# sourceMappingURL=circuit-breaker.js.map