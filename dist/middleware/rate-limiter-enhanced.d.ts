import type { NextFunction, Request, Response } from 'express';
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyPrefix?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
}
interface RateLimitInfo {
    limit: number;
    remaining: number;
    reset: Date;
    retryAfter?: number;
}
export declare const createRateLimiter: (config?: Partial<RateLimitConfig>) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const resetRateLimit: (identifier?: string) => Promise<void>;
export declare const getRateLimitStatus: (identifier: string) => Promise<Record<string, RateLimitInfo> | null>;
declare const _default: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export default _default;
//# sourceMappingURL=rate-limiter-enhanced.d.ts.map