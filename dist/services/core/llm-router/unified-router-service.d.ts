import { EventEmitter } from 'events';
import { BaseService, LLMRequest, LLMResponse, LLMProvider } from '../../shared/interfaces';
export interface RoutingStrategy {
    name: 'round-robin' | 'least-latency' | 'load-balanced' | 'cost-optimized' | 'quality-optimized';
    config: Record<string, any>;
}
export interface ModelPerformanceMetrics {
    modelId: string;
    provider: string;
    averageLatency: number;
    errorRate: number;
    tokensPerSecond: number;
    costPerToken: number;
    qualityScore: number;
    availability: number;
    lastUsed: Date;
    totalRequests: number;
    successfulRequests: number;
}
export interface RoutingRule {
    id: string;
    name: string;
    conditions: {
        userTier?: string;
        taskType?: string;
        promptLength?: {
            min?: number;
            max?: number;
        };
        maxTokens?: {
            min?: number;
            max?: number;
        };
        priorityLevel?: 'low' | 'medium' | 'high' | 'urgent';
    };
    targetModels: string[];
    fallbackModels: string[];
    strategy: RoutingStrategy;
    enabled: boolean;
    priority: number;
}
export interface RouterConfig {
    defaultStrategy: RoutingStrategy;
    enableFallbacks: boolean;
    maxRetries: number;
    timeoutMs: number;
    circuitBreakerConfig: {
        failureThreshold: number;
        resetTimeoutMs: number;
        monitoringPeriodMs: number;
    };
    loadBalancing: {
        algorithm: 'round-robin' | 'weighted' | 'least-connections';
        healthCheckInterval: number;
    };
    caching: {
        enabled: boolean;
        ttlMs: number;
        maxSize: number;
    };
}
declare class UnifiedLLMRouterService extends EventEmitter implements BaseService {
    readonly name = "unified-llm-router";
    readonly version = "1.0.0";
    status: 'active' | 'inactive' | 'error' | 'initializing';
    private readonly config;
    private readonly providers;
    private readonly routingRules;
    private readonly modelMetrics;
    private readonly responseCache;
    private readonly requestQueue;
    private isInitialized;
    private healthCheckTimer?;
    private metricsUpdateTimer?;
    private requestCounter;
    constructor();
    initialize(): Promise<void>;
    healthCheck(): Promise<boolean>;
    shutdown(): Promise<void>;
    routeRequest(request: LLMRequest): Promise<LLMResponse>;
    selectModel(request: LLMRequest, rule?: RoutingRule, strategy?: RoutingStrategy): Promise<string | null>;
    private selectByLatency;
    private selectByCost;
    private selectByQuality;
    private selectByLoad;
    private selectRoundRobin;
    private executeWithFallbacks;
    private executeRequest;
    private callProvider;
    private initializeProviders;
    registerProvider(provider: LLMProvider): Promise<void>;
    private initializeDefaultRoutingRules;
    addRoutingRule(rule: RoutingRule): void;
    removeRoutingRule(ruleId: string): void;
    private findApplicableRule;
    private matchesConditions;
    private getAvailableModels;
    private isModelHealthy;
    private getProviderForModel;
    private estimateOutputTokens;
    private generateRequestId;
    private getCachedResponse;
    private cacheResponse;
    private generateCacheKey;
    private updateRequestMetrics;
    private startHealthChecks;
    private startMetricsUpdates;
    private performHealthChecks;
    private checkProviderHealth;
    private updateMetrics;
    private calculateAverageLatency;
    getProviders(): LLMProvider[];
    getModelMetrics(): ModelPerformanceMetrics[];
    getRoutingRules(): RoutingRule[];
    updateRoutingRule(ruleId: string, updates: Partial<RoutingRule>): void;
    getStats(): {
        totalRequests: number;
        totalProviders: number;
        healthyProviders: number;
        averageLatency: number;
        cacheHitRate: number;
    };
}
export declare const unifiedLLMRouter: UnifiedLLMRouterService;
export {};
//# sourceMappingURL=unified-router-service.d.ts.map