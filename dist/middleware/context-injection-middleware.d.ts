import type { NextFunction, Request, Response } from 'express';
export interface ContextualRequest extends Request {
    mcpContext?: {
        relevantContext: any[];
        contextTokens: number;
        contextSources: string[];
        cached: boolean;
    };
    originalMessages?: any[];
    enhancedMessages?: any[];
}
interface ContextInjectionOptions {
    enabled?: boolean;
    maxContextTokens?: number;
    cacheContext?: boolean;
    contextTypes?: string[];
    securityLevel?: 'strict' | 'moderate' | 'relaxed';
    fallbackOnError?: boolean;
}
export declare function contextInjectionMiddleware(options?: ContextInjectionOptions): (req: ContextualRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function chatContextMiddleware(): (req: ContextualRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function agentContextMiddleware(): (req: ContextualRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function codeContextMiddleware(): (req: ContextualRequest, res: Response, next: NextFunction) => Promise<void>;
export default contextInjectionMiddleware;
//# sourceMappingURL=context-injection-middleware.d.ts.map