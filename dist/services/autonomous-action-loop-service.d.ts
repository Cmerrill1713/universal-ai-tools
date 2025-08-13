import { TaskType } from '@/types';
export interface AutonomousAction {
    id: string;
    type: 'parameter_adjustment' | 'model_switch' | 'prompt_optimization' | 'feature_toggle' | 'configuration_update';
    priority: 'critical' | 'high' | 'medium' | 'low';
    target: {
        service: string;
        component: string;
        property: string;
        taskType?: TaskType;
    };
    change: {
        from: any;
        to: any;
        rationale: string;
    };
    assessment: {
        riskLevel: 'low' | 'medium' | 'high';
        confidenceScore: number;
        expectedImpact: number;
        implementationComplexity: 'simple' | 'moderate' | 'complex';
        reversibilityScore: number;
    };
    evidence: {
        sources: string[];
        supportingData: any[];
        historicalPerformance: any;
        userImpact: {
            affectedUsers: number;
            potentialBenefit: string;
        };
    };
    execution: {
        method: 'immediate' | 'gradual_rollout' | 'ab_test' | 'canary_deployment';
        rollbackTriggers: Array<{
            metric: string;
            threshold: number;
            operator: 'lt' | 'gt' | 'eq';
        }>;
        monitoringPeriod: number;
        successCriteria: Array<{
            metric: string;
            improvementTarget: number;
        }>;
    };
    createdAt: Date;
    implementedAt?: Date;
    status: 'pending' | 'approved' | 'implementing' | 'active' | 'rolled_back' | 'completed';
    implementationResult?: ImplementationResult;
}
export interface ImplementationResult {
    success: boolean;
    metricsBeforeAfter: {
        before: Record<string, number>;
        after: Record<string, number>;
        improvement: Record<string, number>;
    };
    duration: number;
    issues: string[];
    userFeedback?: {
        positive: number;
        negative: number;
        neutral: number;
    };
    rollbackRequired: boolean;
    rollbackReason?: string;
}
export interface RiskAssessmentCriteria {
    taskType: TaskType;
    maxRiskLevel: 'low' | 'medium' | 'high';
    minConfidence: number;
    requiresApproval: boolean;
    blacklistedProperties: string[];
    maxImpactRadius: number;
}
export interface AutonomousActionPolicy {
    enabled: boolean;
    maxActionsPerHour: number;
    maxConcurrentActions: number;
    riskThresholds: {
        low: {
            minConfidence: number;
            autoApprove: boolean;
        };
        medium: {
            minConfidence: number;
            autoApprove: boolean;
        };
        high: {
            minConfidence: number;
            autoApprove: boolean;
        };
    };
    cooldownPeriods: {
        afterRollback: number;
        betweenSimilarActions: number;
    };
    safeguards: {
        maxParameterChange: number;
        requireUserApprovalFor: string[];
        emergencyStop: boolean;
    };
}
export declare class AutonomousActionLoopService {
    private supabase;
    private actionQueue;
    private activeActions;
    private implementationHistory;
    private policy;
    private riskAssessmentCache;
    private isProcessing;
    private lastInsightCollection;
    private actionMetrics;
    constructor();
    private initializeSupabase;
    private initializePolicy;
    private startAutonomousLoop;
    private collectAndProcessInsights;
    private gatherAllInsights;
    private generateActionsFromFeedback;
    private generateActionsFromOptimization;
    private generateActionsFromSignal;
    private assessActionRisk;
    private shouldAutoImplement;
    private enqueueAction;
    private processActionQueue;
    private implementAction;
    private executeChange;
    private adjustParameter;
    private switchModel;
    private optimizePrompt;
    private updateConfiguration;
    private startActionMonitoring;
    private evaluateActionResults;
    private rollbackAction;
    private learnFromImplementation;
    private adjustRiskAssessmentModel;
    private monitorActiveActions;
    private getCurrentParameterValue;
    private captureMetrics;
    private calculateImprovement;
    private triggerConditionMet;
    private isInCooldownPeriod;
    private isWithinRateLimit;
    private generateActionId;
    queueAction(action: AutonomousAction): Promise<void>;
    getActionStatus(): Promise<{
        activeActions: number;
        queuedActions: number;
        metrics: {
            totalActions: number;
            successfulActions: number;
            rolledBackActions: number;
            averageImprovement: number;
        };
        policy: AutonomousActionPolicy;
    }>;
    pauseAutonomousActions(): Promise<void>;
    resumeAutonomousActions(): Promise<void>;
    getActionHistory(limit?: number): Promise<AutonomousAction[]>;
}
export declare const autonomousActionLoopService: AutonomousActionLoopService;
export default autonomousActionLoopService;
//# sourceMappingURL=autonomous-action-loop-service.d.ts.map