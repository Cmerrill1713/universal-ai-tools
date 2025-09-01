/**
 * TypeScript integration for Rust-based Intelligent Parameter Service
 * ML-powered automatic parameter optimization for LLM calls
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FFI bindings to Rust service
interface ParameterServiceNative {
    parameter_service_new(
        enable_ml: boolean,
        learning_rate: number,
        exploration_rate: number,
        cache_ttl: number,
        max_history: number,
        redis_url: string | null
    ): Buffer;
    parameter_service_optimize(service: Buffer, request_json: string): string | null;
    parameter_service_feedback(service: Buffer, feedback_json: string): boolean;
    parameter_service_analytics(service: Buffer): string | null;
    parameter_service_free_string(str: Buffer): void;
    parameter_service_free(service: Buffer): void;
}

// Load the native module
let nativeModule: ParameterServiceNative | null = null;

try {
    const require = createRequire(import.meta.url);
    const libPath = path.join(
        __dirname,
        '../../rust-services/intelligent-parameter-service/target/release/libintelligent_parameter_service'
    );
    
    const extensions = process.platform === 'darwin' ? ['.dylib'] :
                       process.platform === 'win32' ? ['.dll'] : ['.so'];
    
    for (const ext of extensions) {
        try {
            nativeModule = require(libPath + ext);
            logger.info(`✅ Loaded native intelligent parameter service from ${libPath}${ext}`);
            break;
        } catch (e) {
            // Try next extension
        }
    }
} catch (error) {
    logger.warn('⚠️ Native intelligent parameter service not available, using fallback');
}

// TypeScript types
export type OptimizationPriority = 'quality' | 'speed' | 'cost' | 'balanced' | 'consistency';
export type ResponseStyle = 'concise' | 'detailed' | 'technical' | 'creative' | 'formal' | 'casual';
export type TaskType = 'code_generation' | 'code_review' | 'explanation' | 'summarization' | 
                       'translation' | 'creative' | 'analysis' | 'question_answering' | 
                       'conversation' | 'reasoning' | 'general';

export interface ParameterRequest {
    id?: string;
    model: string;
    prompt: string;
    context?: string;
    user_preferences: UserPreferences;
    constraints?: ParameterConstraints;
    metadata?: Record<string, any>;
}

export interface UserPreferences {
    priority: OptimizationPriority;
    quality_threshold: number;
    max_latency_ms?: number;
    max_tokens?: number;
    preferred_style?: ResponseStyle;
}

export interface ParameterConstraints {
    temperature_range?: [number, number];
    top_p_range?: [number, number];
    top_k_range?: [number, number];
    max_tokens_limit?: number;
    presence_penalty_range?: [number, number];
    frequency_penalty_range?: [number, number];
}

export interface OptimalParameters {
    temperature: number;
    top_p: number;
    top_k?: number;
    max_tokens: number;
    presence_penalty: number;
    frequency_penalty: number;
    repetition_penalty?: number;
    seed?: number;
    stop_sequences: string[];
    confidence: number;
    reasoning: string[];
    expected_quality: number;
    expected_latency_ms: number;
}

export interface PerformanceFeedback {
    task_id: string;
    parameters_used: OptimalParameters;
    task_type: TaskType;
    quality_score: number;
    latency_ms: number;
    token_count: number;
    cost_estimate: number;
    user_satisfaction?: number;
    error_occurred: boolean;
    timestamp: string;
}

export interface PerformanceAnalytics {
    total_requests: number;
    cache_hit_rate: number;
    avg_quality_score: number;
    avg_latency_ms: number;
    optimization_improvements: {
        quality_improvement: number;
        latency_reduction: number;
        cost_reduction: number;
        consistency_improvement: number;
    };
    task_distribution: Record<TaskType, number>;
}

export interface ServiceConfig {
    enable_ml?: boolean;
    learning_rate?: number;
    exploration_rate?: number;
    cache_ttl?: number;
    max_history?: number;
    redis_url?: string;
}

/**
 * Intelligent Parameter Service with ML-based optimization
 */
export class IntelligentParameterService {
    private nativeService: Buffer | null = null;
    private config: Required<ServiceConfig>;
    private fallbackParameters: Map<TaskType, OptimalParameters>;
    
    constructor(config: ServiceConfig = {}) {
        this.config = {
            enable_ml: config.enable_ml ?? true,
            learning_rate: config.learning_rate ?? 0.01,
            exploration_rate: config.exploration_rate ?? 0.1,
            cache_ttl: config.cache_ttl ?? 3600,
            max_history: config.max_history ?? 10000,
            redis_url: config.redis_url ?? 'redis://localhost:6379'
        };
        
        this.fallbackParameters = this.initializeFallbackParameters();
        this.initializeNativeService();
    }
    
    private initializeNativeService(): void {
        if (nativeModule) {
            try {
                this.nativeService = nativeModule.parameter_service_new(
                    this.config.enable_ml,
                    this.config.learning_rate,
                    this.config.exploration_rate,
                    this.config.cache_ttl,
                    this.config.max_history,
                    this.config.redis_url
                );
                logger.info('🧠 Native intelligent parameter service initialized');
            } catch (error) {
                logger.error('Failed to initialize native parameter service:', error);
                this.nativeService = null;
            }
        }
    }
    
    /**
     * Get optimal parameters for a task
     */
    async getOptimalParameters(request: ParameterRequest): Promise<OptimalParameters> {
        // Ensure request has an ID
        const fullRequest = {
            ...request,
            id: request.id || uuidv4(),
            constraints: request.constraints || this.getDefaultConstraints()
        };
        
        if (this.nativeService && nativeModule) {
            try {
                const requestJson = JSON.stringify(fullRequest);
                const resultJson = nativeModule.parameter_service_optimize(
                    this.nativeService,
                    requestJson
                );
                
                if (resultJson) {
                    const result = JSON.parse(resultJson);
                    nativeModule.parameter_service_free_string(Buffer.from(resultJson));
                    return result;
                }
            } catch (error) {
                logger.error('Native parameter optimization failed:', error);
            }
        }
        
        // Fallback to TypeScript implementation
        return this.optimizeFallback(fullRequest);
    }
    
    /**
     * Record performance feedback
     */
    async recordFeedback(feedback: PerformanceFeedback): Promise<void> {
        if (this.nativeService && nativeModule) {
            try {
                const feedbackJson = JSON.stringify(feedback);
                const success = nativeModule.parameter_service_feedback(
                    this.nativeService,
                    feedbackJson
                );
                
                if (success) {
                    logger.debug('Performance feedback recorded');
                    return;
                }
            } catch (error) {
                logger.error('Failed to record feedback:', error);
            }
        }
        
        // Fallback: just log the feedback
        logger.info('Feedback (fallback):', feedback);
    }
    
    /**
     * Get performance analytics
     */
    async getAnalytics(): Promise<PerformanceAnalytics> {
        if (this.nativeService && nativeModule) {
            try {
                const analyticsJson = nativeModule.parameter_service_analytics(this.nativeService);
                
                if (analyticsJson) {
                    const analytics = JSON.parse(analyticsJson);
                    nativeModule.parameter_service_free_string(Buffer.from(analyticsJson));
                    return analytics;
                }
            } catch (error) {
                logger.error('Failed to get analytics:', error);
            }
        }
        
        // Return default analytics
        return {
            total_requests: 0,
            cache_hit_rate: 0,
            avg_quality_score: 0,
            avg_latency_ms: 0,
            optimization_improvements: {
                quality_improvement: 0,
                latency_reduction: 0,
                cost_reduction: 0,
                consistency_improvement: 0
            },
            task_distribution: {}
        };
    }
    
    /**
     * Fallback parameter optimization
     */
    private optimizeFallback(request: ParameterRequest): OptimalParameters {
        const taskType = this.classifyTaskType(request.prompt);
        let params = this.fallbackParameters.get(taskType) || this.getDefaultParameters();
        
        // Adjust based on user preferences
        params = this.adjustForPreferences(params, request.user_preferences);
        
        // Apply constraints
        if (request.constraints) {
            params = this.applyConstraints(params, request.constraints);
        }
        
        return params;
    }
    
    /**
     * Classify task type from prompt
     */
    private classifyTaskType(prompt: string): TaskType {
        const lower = prompt.toLowerCase();
        
        if (lower.includes('code') || lower.includes('function')) return 'code_generation';
        if (lower.includes('review')) return 'code_review';
        if (lower.includes('explain')) return 'explanation';
        if (lower.includes('summarize')) return 'summarization';
        if (lower.includes('translate')) return 'translation';
        if (lower.includes('create') || lower.includes('write')) return 'creative';
        if (lower.includes('analyze')) return 'analysis';
        if (lower.includes('?') || lower.includes('how')) return 'question_answering';
        
        return 'general';
    }
    
    /**
     * Adjust parameters based on user preferences
     */
    private adjustForPreferences(
        params: OptimalParameters,
        preferences: UserPreferences
    ): OptimalParameters {
        const adjusted = { ...params };
        
        switch (preferences.priority) {
            case 'quality':
                adjusted.temperature *= 0.9;
                adjusted.top_p = Math.min(adjusted.top_p * 1.05, 1.0);
                break;
            case 'speed':
                adjusted.max_tokens = Math.max(adjusted.max_tokens / 2, 256);
                adjusted.temperature *= 1.1;
                break;
            case 'consistency':
                adjusted.temperature *= 0.7;
                adjusted.seed = 12345;
                break;
        }
        
        if (preferences.max_tokens) {
            adjusted.max_tokens = preferences.max_tokens;
        }
        
        return adjusted;
    }
    
    /**
     * Apply constraints to parameters
     */
    private applyConstraints(
        params: OptimalParameters,
        constraints: ParameterConstraints
    ): OptimalParameters {
        const constrained = { ...params };
        
        if (constraints.temperature_range) {
            constrained.temperature = Math.max(
                constraints.temperature_range[0],
                Math.min(constraints.temperature_range[1], constrained.temperature)
            );
        }
        
        if (constraints.top_p_range) {
            constrained.top_p = Math.max(
                constraints.top_p_range[0],
                Math.min(constraints.top_p_range[1], constrained.top_p)
            );
        }
        
        if (constraints.max_tokens_limit) {
            constrained.max_tokens = Math.min(constrained.max_tokens, constraints.max_tokens_limit);
        }
        
        return constrained;
    }
    
    /**
     * Initialize fallback parameters
     */
    private initializeFallbackParameters(): Map<TaskType, OptimalParameters> {
        const params = new Map<TaskType, OptimalParameters>();
        
        params.set('code_generation', {
            temperature: 0.2,
            top_p: 0.95,
            top_k: 40,
            max_tokens: 2048,
            presence_penalty: 0,
            frequency_penalty: 0,
            repetition_penalty: 1.05,
            stop_sequences: ['```'],
            confidence: 0.8,
            reasoning: ['Optimized for code generation'],
            expected_quality: 0.85,
            expected_latency_ms: 1200
        });
        
        params.set('creative', {
            temperature: 0.9,
            top_p: 0.95,
            top_k: 50,
            max_tokens: 2048,
            presence_penalty: 0.5,
            frequency_penalty: 0.3,
            repetition_penalty: 1.2,
            stop_sequences: [],
            confidence: 0.75,
            reasoning: ['Optimized for creativity'],
            expected_quality: 0.8,
            expected_latency_ms: 1500
        });
        
        return params;
    }
    
    /**
     * Get default parameters
     */
    private getDefaultParameters(): OptimalParameters {
        return {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            max_tokens: 1024,
            presence_penalty: 0,
            frequency_penalty: 0,
            stop_sequences: [],
            confidence: 0.5,
            reasoning: ['Default parameters'],
            expected_quality: 0.7,
            expected_latency_ms: 1000
        };
    }
    
    /**
     * Get default constraints
     */
    private getDefaultConstraints(): ParameterConstraints {
        return {
            temperature_range: [0.0, 2.0],
            top_p_range: [0.0, 1.0],
            top_k_range: [1, 100],
            max_tokens_limit: 4096,
            presence_penalty_range: [-2.0, 2.0],
            frequency_penalty_range: [-2.0, 2.0]
        };
    }
    
    /**
     * Clean up native resources
     */
    dispose(): void {
        if (this.nativeService && nativeModule) {
            nativeModule.parameter_service_free(this.nativeService);
            this.nativeService = null;
            logger.info('Native parameter service disposed');
        }
    }
}

// Export singleton instance
export const intelligentParameterService = new IntelligentParameterService();