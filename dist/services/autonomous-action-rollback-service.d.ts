export interface RollbackTrigger {
    id: string;
    actionId: string;
    metric: string;
    threshold: number;
    operator: 'lt' | 'gt' | 'eq';
    triggered: boolean;
    triggeredAt?: Date;
}
export interface RollbackResult {
    success: boolean;
    actionId: string;
    reason: string;
    metricsBefore: Record<string, number>;
    metricsAfter: Record<string, number>;
    duration: number;
    timestamp: Date;
}
export interface PerformanceBaseline {
    actionId: string;
    metrics: Record<string, number>;
    timestamp: Date;
    validUntil: Date;
}
export declare class AutonomousActionRollbackService {
    private supabase;
    private activeRollbacks;
    private performanceBaselines;
    private rollbackTriggers;
    constructor();
    private initializeSupabase;
    setBaseline(actionId: string, metrics: Record<string, number>): Promise<void>;
    addRollbackTriggers(actionId: string, triggers: Omit<RollbackTrigger, 'id' | 'triggered'>[]): Promise<void>;
    checkRollbackNeeded(actionId: string, currentMetrics: Record<string, number>): Promise<RollbackTrigger | null>;
    executeRollback(actionId: string, reason: string): Promise<RollbackResult>;
    getRollbackHistory(actionId: string): Promise<RollbackResult[]>;
    getStatus(): Promise<{
        activeRollbacks: number;
        totalBaselines: number;
        totalTriggers: number;
        lastRollback?: Date;
    }>;
}
export declare const autonomousActionRollbackService: AutonomousActionRollbackService;
//# sourceMappingURL=autonomous-action-rollback-service.d.ts.map