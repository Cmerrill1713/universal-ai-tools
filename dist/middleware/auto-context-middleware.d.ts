import type { NextFunction, Request, Response } from 'express';
interface ContextMiddlewareOptions {
    enableAutoTracking?: boolean;
    enableContextInjection?: boolean;
    enableTokenLimitMonitoring?: boolean;
    maxContextTokens?: number;
    compressionThreshold?: number;
    persistenceThreshold?: number;
    excludeRoutes?: string[];
    includeRoutes?: string[];
}
interface EnhancedRequest extends Request {
    contextInfo?: {
        sessionId: string;
        userId: string;
        projectPath?: string;
        workingDirectory?: string;
        conversationId?: string;
        contextMetadata?: Record<string, any>;
    };
    originalBody?: any;
    enhancedBody?: {
        originalRequest: any;
        enrichedPrompt: string;
        contextSummary: string;
        sourcesUsed: string[];
        tokenCount: number;
    };
}
interface ContextSession {
    sessionId: string;
    userId: string;
    lastActivity: Date;
    messageCount: number;
    totalTokens: number;
    compressionLevel: number;
    metadata: Record<string, any>;
}
export declare class AutoContextMiddleware {
    private options;
    private sessions;
    private readonly SESSION_TIMEOUT;
    private cleanupTimer?;
    private readonly CLEANUP_INTERVAL;
    constructor(options?: ContextMiddlewareOptions);
    middleware(): (req: EnhancedRequest, res: Response, next: NextFunction) => Promise<void>;
    private extractContextInfo;
    private updateSession;
    private injectContextIntoRequest;
    private trackResponse;
    private extractUserRequest;
    private extractAssistantResponse;
    private updateRequestWithEnrichedContent;
    private isLLMRequest;
    private shouldSkipRoute;
    private startSessionCleanup;
    private cleanupExpiredSessions;
    getStats(): {
        activeSessions: number;
        totalMessages: number;
        averageTokensPerSession: number;
        compressionRate: number;
    };
    cleanupSession(sessionId: string, userId: string): boolean;
    getSession(sessionId: string, userId: string): ContextSession | null;
    shutdown(): void;
}
export declare const autoContextMiddleware: AutoContextMiddleware;
export declare const contextMiddleware: (req: EnhancedRequest, res: Response, next: NextFunction) => Promise<void>;
export default contextMiddleware;
//# sourceMappingURL=auto-context-middleware.d.ts.map