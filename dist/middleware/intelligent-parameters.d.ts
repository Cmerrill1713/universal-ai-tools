import type { NextFunction, Request, Response } from 'express';
import type { OptimizedParameters } from '@/types';
import { TaskType } from '@/types';
import type { TaskContext, UserPreferences } from '../services/intelligent-parameter-service';
export interface IntelligentRequest extends Request {
    taskContext?: TaskContext;
    optimizedParameters?: unknown;
    originalBody?: unknown;
}
export interface ParameterOverrides {
    temperature?: number;
    maxTokens?: number;
    contextLength?: number;
    systemPrompt?: string;
    taskType?: TaskType;
    forceParameters?: boolean;
}
export declare function intelligentParametersMiddleware(overrides?: ParameterOverrides): (req: IntelligentRequest, res: Response, next: NextFunction) => void;
export declare function chatParametersMiddleware(): (req: IntelligentRequest, res: Response, next: NextFunction) => void;
export declare function codeParametersMiddleware(): (req: IntelligentRequest, res: Response, next: NextFunction) => void;
export declare function analysisParametersMiddleware(): (req: IntelligentRequest, res: Response, next: NextFunction) => void;
export declare function creativeParametersMiddleware(): (req: IntelligentRequest, res: Response, next: NextFunction) => void;
export declare function visionParametersMiddleware(): (req: IntelligentRequest, res: Response, next: NextFunction) => void;
export declare function parameterEffectivenessLogger(): (req: IntelligentRequest, res: Response, next: NextFunction) => void;
export declare function optimizeParameters(userInput: string, options?: {
    taskType?: TaskType;
    model?: string;
    domain?: string;
    complexity?: 'simple' | 'medium' | 'complex';
    userPreferences?: UserPreferences;
    overrides?: ParameterOverrides;
}): OptimizedParameters;
export default intelligentParametersMiddleware;
//# sourceMappingURL=intelligent-parameters.d.ts.map