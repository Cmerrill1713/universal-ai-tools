import type { NextFunction, Request, Response } from 'express';
export interface ErrorMetrics {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByPath: Record<string, number>;
    errorsByStatusCode: Record<number, number>;
    averageResponseTime: number;
    lastError: Date;
}
export interface ErrorContext {
    requestId: string;
    userId?: string;
    userAgent?: string;
    ip: string;
    path: string;
    method: string;
    timestamp: Date;
    responseTime: number;
    headers: Record<string, string>;
    body?: any;
    query?: any;
    params?: any;
}
export interface AlertConfig extends Record<string, unknown> {
    enabled: boolean;
    thresholds: {
        errorRate: number;
        responseTime: number;
        consecutiveErrors: number;
    };
    webhooks?: string[];
    email?: string[];
}
declare class ErrorTrackingService {
    private metrics;
    private recentErrors;
    private consecutiveErrors;
    private lastSuccessTime;
    private responseTimeBuffer;
    private alertConfig;
    private maxRecentErrors;
    constructor(alertConfig?: Partial<AlertConfig>);
    errorHandler(): (error: Error, req: Request, res: Response, next: NextFunction) => void;
    timingMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    private trackError;
    private trackResponseTime;
    private checkAlerts;
    private sendAlert;
    private getStatusCode;
    private getErrorMessage;
    private sanitizeHeaders;
    private sanitizeBody;
    private generateRequestId;
    private cleanupOldErrors;
    getMetrics(): ErrorMetrics & {
        consecutiveErrors: number;
        recentErrorCount: number;
        uptime: number;
    };
    getRecentErrors(limit?: number): ErrorContext[];
    getErrorTrends(): {
        hourly: number[];
        byPath: Array<{
            path: string;
            count: number;
        }>;
        byType: Array<{
            type: string;
            count: number;
        }>;
    };
    reset(): void;
    updateAlertConfig(config: Partial<AlertConfig>): void;
}
export declare const errorTrackingService: ErrorTrackingService;
export default ErrorTrackingService;
//# sourceMappingURL=error-tracking-middleware.d.ts.map