import { EventEmitter } from 'events';
interface UserInteraction {
    userId: string;
    sessionId: string;
    timestamp: Date;
    interactionType: 'model_selection' | 'prompt_submission' | 'response_rating' | 'correction' | 'regeneration';
    modelId: string;
    providerId: string;
    prompt?: string;
    response?: string;
    rating?: number;
    feedback?: string;
    context?: Record<string, any>;
    taskType?: string;
    responseTime?: number;
    tokenCount?: number;
    wasRegenerated?: boolean;
    corrections?: string[];
}
interface UserPreferences {
    userId: string;
    modelPreferences: Record<string, ModelPreference>;
    taskPreferences: Record<string, TaskPreference>;
    generalPreferences: GeneralPreferences;
    adaptiveWeights: AdaptiveWeights;
    lastUpdated: Date;
    version: number;
}
interface ModelPreference {
    modelId: string;
    providerId: string;
    overallScore: number;
    taskScores: Record<string, number>;
    usageCount: number;
    avgRating: number;
    avgResponseTime: number;
    successRate: number;
    lastUsed: Date;
    preferenceStrength: number;
}
interface TaskPreference {
    taskType: string;
    preferredModels: string[];
    avgComplexity: number;
    preferredLength: 'short' | 'medium' | 'long';
    preferredStyle: 'formal' | 'casual' | 'technical' | 'creative' | 'neutral';
    contextImportance: number;
}
interface GeneralPreferences {
    responseSpeed: 'fast' | 'balanced' | 'quality';
    creativityLevel: number;
    technicalDetail: number;
    explainationDepth: number;
    preferredTone: 'professional' | 'friendly' | 'neutral';
    languageComplexity: 'simple' | 'moderate' | 'advanced';
}
interface AdaptiveWeights {
    recencyWeight: number;
    frequencyWeight: number;
    ratingWeight: number;
    contextWeight: number;
    performanceWeight: number;
}
interface PreferenceLearningConfig {
    minInteractionsForPreference: number;
    decayFactor: number;
    contextSimilarityThreshold: number;
    adaptationRate: number;
    collaborativeFilteringEnabled: boolean;
    explicitFeedbackWeight: number;
    implicitFeedbackWeight: number;
}
interface ModelRecommendation {
    modelId: string;
    providerId: string;
    confidence: number;
    reasons: string[];
    expectedPerformance: number;
    estimatedResponseTime: number;
}
interface ContextVector {
    taskType: string;
    complexity: number;
    urgency: number;
    creativity: number;
    technicalLevel: number;
    previousContext?: string;
    userMood?: string;
    timeOfDay?: string;
}
declare class UserPreferenceLearningService extends EventEmitter {
    private readonly config;
    private readonly userPreferences;
    private readonly interactionBuffer;
    private readonly contextCache;
    private isInitialized;
    private readonly BUFFER_SIZE;
    private readonly BATCH_PROCESSING_INTERVAL;
    private processingTimer?;
    constructor();
    initialize(): Promise<void>;
    private startBatchProcessing;
    recordInteraction(interaction: UserInteraction): Promise<void>;
    private processInteractionImmediate;
    private updateModelPreference;
    private updateContextLearning;
    getModelRecommendations(userId: string, context: ContextVector, topN?: number): Promise<ModelRecommendation[]>;
    private calculateModelRecommendation;
    private applyCollaborativeFiltering;
    private findSimilarUsers;
    private calculateUserSimilarity;
    private processBatchedInteractions;
    private adaptiveUpdate;
    private calculatePreferenceStrength;
    private extractContextVector;
    private updateAdaptiveWeights;
    private getUserPreferences;
    private saveUserPreferences;
    private loadUserPreferences;
    private storeInteractions;
    private initializeCollaborativeFiltering;
    private createDefaultUserPreferences;
    private getDefaultGeneralPreferences;
    private getDefaultAdaptiveWeights;
    getPersonalizedModelSelection(userId: string, context: ContextVector): Promise<string>;
    updateUserFeedback(userId: string, sessionId: string, modelId: string, providerId: string, rating: number, feedback?: string): Promise<void>;
    getUserInsights(userId: string): Promise<any>;
    shutdown(): Promise<void>;
}
export declare const userPreferenceLearningService: UserPreferenceLearningService;
export type { ContextVector, ModelPreference, ModelRecommendation, PreferenceLearningConfig, UserInteraction, UserPreferences, };
//# sourceMappingURL=user-preference-learning-service.d.ts.map