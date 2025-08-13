import { EventEmitter } from 'events';
export interface TrainingThresholds extends Record<string, unknown> {
    qualityScore: number;
    errorRate: number;
    responseTime: {
        simple: number;
        moderate: number;
        complex: number;
    };
    userFeedback: {
        negative: number;
        regenerations: number;
    };
    minSamplesRequired: number;
}
export interface ModelMetrics {
    modelId: string;
    provider: string;
    avgQuality: number;
    errorRate: number;
    avgResponseTime: number;
    negativeFeedback: number;
    regenerationRate: number;
    sampleCount: number;
    lastEvaluated: Date;
}
export interface TrainingJob {
    id: string;
    modelId: string;
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    dataset: any[];
    config: {
        method: 'lora' | 'qlora' | 'full';
        epochs: number;
        learningRate: number;
        batchSize: number;
    };
    status: 'queued' | 'training' | 'evaluating' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    metrics?: {
        loss: number;
        accuracy?: number;
        improvement?: number;
    };
}
export declare class AdaptiveTrainingService extends EventEmitter {
    private thresholds;
    private modelMetrics;
    private trainingQueue;
    private isTraining;
    private trainingLock;
    private monitoringInterval;
    private evaluationHistory;
    constructor();
    private startMonitoring;
    private evaluateModels;
    private checkThresholds;
    private scheduleTraining;
    private processTrainingQueue;
    private trainWithMLX;
    private trainWithAlternative;
    private evaluateTraining;
    private prepareTrainingDataset;
    private determineTrainingConfig;
    private getPriorityLevel;
    private estimateModelComplexity;
    private canUseMLX;
    private fetchUserFeedbackMetrics;
    private fetchLowQualityExamples;
    private fetchErrorExamples;
    private fetchNegativeFeedbackExamples;
    private generateSyntheticExamples;
    private loadHistoricalMetrics;
    updateThresholds(thresholds: Partial<TrainingThresholds>): void;
    getTrainingQueue(): TrainingJob[];
    getModelMetrics(): Map<string, ModelMetrics>;
    forceEvaluation(): Promise<void>;
    forceTraining(modelId: string, reason?: string): Promise<void>;
    stop(): void;
}
export declare const adaptiveTrainingService: AdaptiveTrainingService;
//# sourceMappingURL=adaptive-training-service.d.ts.map