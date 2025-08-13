import { EventEmitter } from 'events';
export interface UserInteraction {
    id: string;
    userId: string;
    sessionId: string;
    timestamp: Date;
    type: 'click' | 'scroll' | 'search' | 'selection' | 'command' | 'navigation' | 'task_completion' | 'feedback';
    context: {
        page?: string;
        component?: string;
        action?: string;
        target?: string;
        metadata?: any;
    };
    outcome?: 'success' | 'failure' | 'abandoned' | 'partial';
    duration?: number;
    value?: any;
}
export interface UserPreference {
    id: string;
    userId: string;
    category: 'ui' | 'behavior' | 'content' | 'timing' | 'communication' | 'workflow';
    key: string;
    value: any;
    confidence: number;
    source: 'explicit' | 'inferred' | 'learned' | 'default';
    lastUpdated: Date;
    updateCount: number;
    metadata?: {
        contexts?: string[];
        conditions?: any[];
        alternatives?: any[];
    };
}
export interface BehaviorPattern {
    id: string;
    userId: string;
    name: string;
    description: string;
    pattern: {
        trigger: any;
        sequence: UserInteraction[];
        outcome: any;
    };
    frequency: number;
    confidence: number;
    contexts: string[];
    variations: any[];
    lastSeen: Date;
    firstSeen: Date;
}
export interface PersonalizationModel {
    id: string;
    userId: string;
    modelType: 'preference_prediction' | 'behavior_prediction' | 'recommendation' | 'optimization';
    algorithm: 'collaborative_filtering' | 'content_based' | 'neural_network' | 'decision_tree' | 'clustering';
    features: string[];
    parameters: any;
    performance: {
        accuracy?: number;
        precision?: number;
        recall?: number;
        f1Score?: number;
        lastEvaluated: Date;
    };
    trainingData: {
        samples: number;
        lastTrained: Date;
        version: number;
    };
    status: 'training' | 'ready' | 'deprecated' | 'error';
}
export interface Recommendation {
    id: string;
    userId: string;
    type: 'action' | 'content' | 'setting' | 'workflow' | 'feature';
    title: string;
    description: string;
    reasoning: string;
    confidence: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    metadata: {
        action?: any;
        alternatives?: any[];
        contexts?: string[];
        expectedBenefit?: string;
        effort?: 'low' | 'medium' | 'high';
    };
    status: 'pending' | 'presented' | 'accepted' | 'rejected' | 'ignored' | 'expired';
    createdAt: Date;
    presentedAt?: Date;
    respondedAt?: Date;
    expiresAt?: Date;
}
export interface ABTest {
    id: string;
    name: string;
    description: string;
    hypothesis: string;
    variants: {
        id: string;
        name: string;
        description: string;
        parameters: any;
        allocation: number;
    }[];
    metrics: string[];
    status: 'draft' | 'running' | 'paused' | 'completed' | 'analyzed';
    startDate: Date;
    endDate?: Date;
    results?: {
        variant: string;
        metrics: {
            [key: string]: number;
        };
        significance: number;
        winner?: string;
    }[];
    participants: Map<string, string>;
}
export interface UserSession {
    id: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    interactions: UserInteraction[];
    context: {
        device?: string;
        browser?: string;
        location?: string;
        entryPoint?: string;
    };
    goals?: string[];
    outcomes?: {
        completed: string[];
        abandoned: string[];
        successful: boolean;
    };
}
export interface LearningInsight {
    id: string;
    userId: string;
    type: 'preference_discovered' | 'pattern_identified' | 'behavior_changed' | 'efficiency_gained';
    insight: string;
    evidence: any[];
    confidence: number;
    actionable: boolean;
    recommendedActions?: string[];
    discoveredAt: Date;
    applied: boolean;
}
export declare class UserBehaviorLearningService extends EventEmitter {
    private userInteractions;
    private userPreferences;
    private behaviorPatterns;
    private personalizationModels;
    private recommendations;
    private userSessions;
    private activeSessions;
    private abTests;
    private learningInsights;
    private supabase;
    private isInitialized;
    private learningConfig;
    private patternAnalysisInterval;
    private modelTrainingInterval;
    private recommendationGenerationInterval;
    private insightGenerationInterval;
    constructor();
    private initializeService;
    recordInteraction(interaction: Omit<UserInteraction, 'id' | 'timestamp'>): Promise<string>;
    startSession(userId: string, context?: any): Promise<string>;
    endSession(sessionId: string, outcomes?: any): Promise<void>;
    recordPreference(userId: string, category: UserPreference['category'], key: string, value: any, source?: UserPreference['source'], confidence?: number): Promise<void>;
    getUserPreferences(userId: string, category?: UserPreference['category']): UserPreference[];
    private inferPreferencesFromInteractions;
    private startPatternAnalysis;
    private analyzeUserPatterns;
    private identifySequencePatterns;
    private identifyUsagePatterns;
    private identifyPreferencePatterns;
    private startModelTraining;
    private trainPersonalizationModels;
    private trainUserModels;
    private trainPreferencePredictionModel;
    private trainBehaviorPredictionModel;
    private trainRecommendationModel;
    private startRecommendationGeneration;
    private generateRecommendations;
    private generateUserRecommendations;
    private generateWorkflowRecommendations;
    private generateSettingRecommendations;
    private generateFeatureRecommendations;
    createABTest(testData: Omit<ABTest, 'id' | 'participants' | 'status' | 'startDate'>): Promise<string>;
    startABTest(testId: string): Promise<boolean>;
    getABTestVariant(testId: string, userId: string): string | null;
    private startInsightGeneration;
    private generateInsights;
    private generateUserInsights;
    private analyzeBehaviorChange;
    private analyzePreferenceEvolution;
    private processImediateInteraction;
    private analyzeSession;
    private recordSuccessfulWorkflow;
    private extractSequences;
    private generatePatternId;
    private prepareTrainingData;
    private extractFeatureUsage;
    private getActiveSession;
    private setupSessionManagement;
    private loadUserData;
    private generateId;
    getUserInteractions(userId: string, limit?: number): UserInteraction[];
    getUserPatterns(userId: string): BehaviorPattern[];
    getUserRecommendations(userId: string, status?: Recommendation['status']): Recommendation[];
    getUserInsights(userId: string): LearningInsight[];
    respondToRecommendation(recommendationId: string, response: 'accepted' | 'rejected' | 'ignored'): Promise<boolean>;
    setUserGoals(userId: string, sessionId: string, goals: string[]): Promise<void>;
    getPersonalizationData(userId: string): any;
    getLearningStats(): any;
}
export declare const userBehaviorLearningService: UserBehaviorLearningService;
export default userBehaviorLearningService;
//# sourceMappingURL=user-behavior-learning-service.d.ts.map