import type { NextFunction, Request, Response } from 'express';
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    skipIf?: (req: Request) => boolean;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (req: Request) => string;
    onLimitReached?: (req: Request, res: Response) => void;
}
interface RateLimitRule {
    path: string | RegExp;
    method?: string | string[];
    config: RateLimitConfig;
}
export declare class ComprehensiveRateLimiter {
    private store;
    private rules;
    private globalConfig;
    private cleanupInterval?;
    constructor(globalConfig: RateLimitConfig);
    addRule(rule: RateLimitRule): void;
    middleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private getConfigForRequest;
    private matchesRule;
    private getClientData;
    private getDefaultKey;
    private calculatePenalty;
    private startCleanup;
    getStats(): {
        activeClients: number;
        totalRules: number;
        memoryUsage: number;
    };
    reset(key: string): boolean;
    resetAll(): void;
    shutdown(): void;
}
export declare const createStandardRateLimiter: () => ComprehensiveRateLimiter;
export declare const standardRateLimiter: ComprehensiveRateLimiter;
export default ComprehensiveRateLimiter;
//# sourceMappingURL=comprehensive-rate-limiter.d.ts.map