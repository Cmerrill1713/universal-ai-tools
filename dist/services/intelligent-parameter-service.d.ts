import { TaskType } from '@/types';
export interface TaskParameters {
    contextLength: number;
    temperature: number;
    topP?: number;
    maxTokens: number;
    systemPrompt: string;
    userPromptTemplate: string;
    stopSequences?: string[];
    presencePenalty?: number;
    frequencyPenalty?: number;
}
export interface TaskContext {
    type: TaskType;
    userInput: string;
    additionalContext?: Record<string, any>;
    userPreferences?: UserPreferences;
    complexity?: 'simple' | 'medium' | 'complex';
    domain?: string;
    expectedOutputLength?: 'short' | 'medium' | 'long';
}
export interface UserPreferences {
    preferredTemperature?: number;
    preferredLength?: 'concise' | 'detailed' | 'comprehensive';
    writingStyle?: 'formal' | 'casual' | 'technical';
    creativity?: 'conservative' | 'balanced' | 'creative';
}
export declare class IntelligentParameterService {
    private taskProfiles;
    private contextTemplates;
    private domainAdjustments;
    constructor();
    private initializeTaskProfiles;
    private initializeContextTemplates;
    private initializeDomainAdjustments;
    getTaskParameters(context: TaskContext): TaskParameters;
    private adjustForComplexity;
    private adjustForDomain;
    private adjustForUserPreferences;
    private adjustForOutputLength;
    private buildDynamicPrompt;
    detectTaskType(userInput: string, context?: Record<string, any>): TaskType;
    private containsKeywords;
    private getDefaultParameters;
    getModelOptimizedParameters(baseParams: TaskParameters, modelName: string): TaskParameters;
    createTaskContext(userInput: string, taskType?: TaskType, additionalContext?: Record<string, any>, userPreferences?: UserPreferences): TaskContext;
}
export declare const intelligentParameterService: IntelligentParameterService;
export default intelligentParameterService;
//# sourceMappingURL=intelligent-parameter-service.d.ts.map