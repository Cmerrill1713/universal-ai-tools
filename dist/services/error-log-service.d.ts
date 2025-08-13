export interface ErrorEvent {
    id?: string;
    correlationId?: string;
    path: string;
    method: string;
    message: string;
    stack?: string;
    statusCode?: number;
    metadata?: Record<string, unknown>;
}
export interface CorrectionEvent {
    id?: string;
    correlationId: string;
    fixSummary: string;
    metadata?: Record<string, unknown>;
}
declare class ErrorLogService {
    logError(event: ErrorEvent): Promise<string | null>;
    logCorrection(event: CorrectionEvent): Promise<boolean>;
}
export declare const errorLogService: ErrorLogService;
export {};
//# sourceMappingURL=error-log-service.d.ts.map