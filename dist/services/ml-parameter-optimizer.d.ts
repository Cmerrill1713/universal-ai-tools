import { TaskType } from '@/types';
import type { TaskContext, TaskParameters, UserPreferences } from './intelligent-parameter-service';
import type { OptimizationInsight } from './parameter-analytics-service';
export interface OptimizationExperiment {
    id: string;
    taskType: TaskType;
    parameterSpace: ParameterSpace;
    trials: OptimizationTrial[];
    bestParameters: TaskParameters;
    convergenceStatus: 'exploring' | 'converging' | 'converged';
    startTime: Date;
    lastUpdate: Date;
}
export interface OptimizationTrial {
    id: string;
    parameters: TaskParameters;
    score: number;
    executionTime: number;
    timestamp: Date;
    contextMetadata: Record<string, any>;
}
export interface ParameterSpace {
    temperature: {
        min: number;
        max: number;
        type: 'continuous';
    };
    maxTokens: {
        min: number;
        max: number;
        type: 'discrete';
    };
    topP: {
        min: number;
        max: number;
        type: 'continuous';
    };
    frequencyPenalty: {
        min: number;
        max: number;
        type: 'continuous';
    };
    presencePenalty: {
        min: number;
        max: number;
        type: 'continuous';
    };
}
export interface ModelPerformancePrediction {
    taskType: TaskType;
    predictedParameters: TaskParameters;
    confidenceScore: number;
    expectedPerformance: number;
    uncertaintyBounds: {
        lower: number;
        upper: number;
    };
    recommendationStrength: 'weak' | 'moderate' | 'strong';
}
export interface OptimizationStrategy {
    name: string;
    description: string;
    suitableFor: TaskType[];
    hyperparameters: Record<string, number>;
}
export declare class MLParameterOptimizer {
    private supabase;
    private experiments;
    private bayesianModels;
    private thompsonSelector;
    private parameterSpaces;
    private optimizationStrategies;
    private learningRate;
    private explorationRate;
    private convergenceThreshold;
    constructor();
    private initializeSupabase;
    private initializeOptimizers;
    private setupParameterSpaces;
    private defineOptimizationStrategies;
    getOptimizedParameters(taskType: TaskType, context: TaskContext, userPreferences?: UserPreferences): Promise<ModelPerformancePrediction>;
    learnFromExecution(taskType: TaskType, parameters: TaskParameters, score: number, executionTime: number, contextMetadata?: Record<string, any>): Promise<void>;
    getOptimizationInsights(taskType?: TaskType): Promise<OptimizationInsight[]>;
    private queueMLOptimizationAction;
    private assessParameterChangeRisk;
    createABTest(taskType: TaskType, controlParameters: TaskParameters, testParameters: TaskParameters, trafficSplit?: number): Promise<string>;
    getABTestResults(experimentId: string): Promise<{
        winner: 'control' | 'test' | 'inconclusive';
        controlPerformance: number;
        testPerformance: number;
        statisticalSignificance: number;
        recommendation: string;
    }>;
    private getOrCreateExperiment;
    private getHeuristicPrediction;
    private applyUserPreferences;
    private calculateConfidence;
    private getRecommendationStrength;
    private checkConvergence;
    private calculateVariance;
    private getBestScore;
    private storeExperiment;
    private generateOptimizationInsights;
    private generateTaskTypeInsight;
    private calculateImprovement;
    private generateABTestRecommendation;
    private getInitialParameters;
    private getOrCreateBayesianModel;
    private generateParametersFromPrediction;
    private getParameterHash;
    private generateExperimentId;
    private generateTrialId;
    private startPeriodicOptimization;
    private performPeriodicOptimization;
}
export declare const mlParameterOptimizer: MLParameterOptimizer;
export default mlParameterOptimizer;
//# sourceMappingURL=ml-parameter-optimizer.d.ts.map