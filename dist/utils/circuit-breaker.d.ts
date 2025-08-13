export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerOptions {
    failureThreshold?: number;
    successThreshold?: number;
    timeout?: number;
    volumeThreshold?: number;
    errorThresholdPercentage?: number;
    rollingWindow?: number;
}
export interface CircuitBreakerMetrics {
    totalRequests: number;
    failedRequests: number;
    successfulRequests: number;
    rejectedRequests: number;
    state: CircuitState;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    errorRate: number;
    lastError?: string;
    consecutiveFailures: number;
    nextRetryTime?: number;
    rollingWindowMetrics?: {
        windowSize: number;
        requestsInWindow: number;
        errorsInWindow: number;
    };
}
export declare class CircuitBreaker {
    private name;
    private options;
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime?;
    private nextAttempt?;
    private lastError?;
    private metrics;
    private requestTimestamps;
    constructor(name: string, options?: CircuitBreakerOptions);
    execute<R>(operation: () => Promise<R>, fallback?: () => Promise<R>): Promise<R>;
    private onSuccess;
    private onFailure;
    private openCircuit;
    private recordRequest;
    private shouldOpenByErrorRate;
    private updateMetrics;
    getState(): CircuitState;
    getMetrics(): CircuitBreakerMetrics;
    reset(): void;
    trip(): void;
    close(): void;
    recordFailure(): void;
    getFailureCount(): number;
    getLastFailureTime(): number | undefined;
}
export declare function createCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker;
export declare class CircuitBreakerRegistry {
    private static breakers;
    static register(name: string, breaker: CircuitBreaker): void;
    static get(name: string): CircuitBreaker | undefined;
    static getAll(): Map<string, CircuitBreaker>;
    static getMetrics(): Record<string, CircuitBreakerMetrics>;
    static reset(name?: string): void;
}
export declare function getCircuitBreakerStatus(): Record<string, CircuitBreakerMetrics>;
//# sourceMappingURL=circuit-breaker.d.ts.map