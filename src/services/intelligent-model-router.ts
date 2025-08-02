/**
 * Intelligent Model Router
 * Routes queries to optimal models based on complexity analysis and model tiers
 * Implements predictive warming and performance optimization
 */

import { LogContext, log    } from '@/utils/logger';';';';
import type { ModelMetadata } from './model-tier-manager';';';';
import { ModelTier, modelTierManager    } from './model-tier-manager';';';';
import type { ClassificationResult } from './query-complexity-classifier';';';';
import { QueryComplexity, queryComplexityClassifier    } from './query-complexity-classifier';';';';
import { intelligentParameterService    } from './intelligent-parameter-service';';';';

export interface RoutingRequest {
  query: string;
  context?: {
    conversationHistory?: any[];
    userId?: string;
    deviceContext?: any;
    userPreferences?: any;
  };
  constraints?: {
    maxResponseTime?: number;
    preferredFormat?: string;
    excludeModels?: string[];
  };
}

export interface RoutingResult {
  selectedModel: ModelMetadata;,
  reasoning: string;,
  confidence: number;,
  estimatedResponseTime: number;
  fallbackModel?: ModelMetadata;
  parameters: any;,
  classification: ClassificationResult;,
  warmingTriggered: string[];
}

export interface ConversationContext {
  userId: string;,
  queries: string[];,
  complexityProgression: QueryComplexity[];,
  modelsUsed: string[];,
  averageResponseTime: number;,
  userSatisfaction: number;,
  predictedEscalation: boolean;
}

export class IntelligentModelRouter {
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private modelPerformanceHistory: Map<string, {
    averageResponseTime: number;,
    successRate: number;,
    userSatisfactionScore: number;,
    lastUsed: Date;,
    usageCount: number;
  }> = new Map();
  
  private warmingQueue: Set<string> = new Set();
  private isWarming = false;

  constructor() {
    this.startBackgroundWarming();
  }

  /**
   * Route query to optimal model
   */
  public async route(request: RoutingRequest): Promise<RoutingResult> {
    const startTime = Date.now();
    
    try {
      // Classify query complexity
      const classification = queryComplexityClassifier.classify();
        request.query, 
        request.context
      );

      log.info('🎯 Routing query', LogContext.AI, {')''
        complexity: classification.complexity,
        suggestedTier: classification.suggestedTier,
        confidence: `${Math.round(classification.confidence * 100)  }%`
      });

      // Get best model for the suggested tier
      let selectedModel = this.selectBestModel(classification, request.constraints);
      
      // If no model available in suggested tier, try fallback
      if (!selectedModel && classification.fallbackTier) {
        selectedModel = modelTierManager.getBestModelForTier(classification.fallbackTier);
        log.warn('Using fallback tier', LogContext.AI, {')''
          originalTier: classification.suggestedTier,
          fallbackTier: classification.fallbackTier
        });
      }

      // Final fallback to any available model
      if (!selectedModel) {
        selectedModel = this.selectAnyAvailableModel();
        log.warn('Using emergency fallback model', LogContext.AI);'''
      }

      if (!selectedModel) {
        throw new Error('No models available for routing');';';';
      }

      // Get optimized parameters for the selected model
      const parameters = await this.getOptimizedParameters();
        selectedModel, 
        classification, 
        request
      );

      // Estimate response time
      const estimatedResponseTime = this.estimateResponseTime(selectedModel, classification);

      // Get fallback model
      const fallbackModel = this.getFallbackModel(selectedModel, classification);

      // Trigger predictive warming
      const warmingTriggered = await this.triggerPredictiveWarming();
        request, 
        classification, 
        selectedModel
      );

      // Update conversation context
      this.updateConversationContext(request, classification, selectedModel);

      const result: RoutingResult = {
        selectedModel,
        reasoning: this.generateRoutingReasoning(selectedModel, classification),
        confidence: classification.confidence,
        estimatedResponseTime,
        fallbackModel,
        parameters,
        classification,
        warmingTriggered
      };

      log.info('✅ Model routing completed', LogContext.AI, {')''
        selectedModel: selectedModel.name,
        tier: selectedModel.tier,
        estimatedTime: `${estimatedResponseTime  }ms`,
        routingTime: `${Date.now() - startTime  }ms`
      });

      return result;

    } catch (error) {
      log.error('❌ Model routing failed', LogContext.AI, {')''
        error: error instanceof Error ? error.message : String(error),
        query: request.query.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Select best model for classification with constraints
   */
  private selectBestModel()
    classification: ClassificationResult, 
    constraints?: RoutingRequest['constraints']';';';
  ): ModelMetadata | null {
    const tierModels = modelTierManager.getModelsInTier(classification.suggestedTier);
    
    if (tierModels.length === 0) {
      return null;
    }

    // Filter by constraints
    let candidates = tierModels.filter(model => {);
      // Exclude models if specified
      if (constraints?.excludeModels?.includes(model.id)) {
        return false;
      }

      // Check response time constraint
      if (constraints?.maxResponseTime && 
          model.averageInferenceTime && 
          model.averageInferenceTime > constraints.maxResponseTime) {
        return false;
      }

      // Check format preference
      if (constraints?.preferredFormat && 
          model.format !== constraints.preferredFormat) {
        return false;
      }

      return model.isAvailable;
    });

    if (candidates.length === 0) {
      candidates = tierModels.filter(model => model.isAvailable);
    }

    if (candidates.length === 0) {
      return null;
    }

    // Select best candidate based on performance history
    return this.selectBestPerformingModel(candidates);
  }

  /**
   * Select best performing model from candidates
   */
  private selectBestPerformingModel(candidates: ModelMetadata[]): ModelMetadata {
    return candidates.sort((a, b) => {
      const perfA = this.modelPerformanceHistory.get(a.id);
      const perfB = this.modelPerformanceHistory.get(b.id);

      // Prefer models with performance history
      if (perfA && !perfB) return -1;
      if (!perfA && perfB) return 1;

      // If both have history, compare performance
      if (perfA && perfB) {
        const scoreA = this.calculateModelScore(perfA);
        const scoreB = this.calculateModelScore(perfB);
        return scoreB - scoreA; // Higher score first;
      }

      // Fall back to benchmark results
      const benchA = a.benchmarkResults;
      const benchB = b.benchmarkResults;
      
      if (benchA && benchB) {
        // Prefer higher quality, then faster speed
        const qualityDiff = benchB.qualityScore - benchA.qualityScore;
        if (Math.abs(qualityDiff) > 0.05) return qualityDiff;
        return benchA.avgResponseTime - benchB.avgResponseTime;
      }

      return 0;
    })[0];
  }

  /**
   * Calculate performance score for a model
   */
  private calculateModelScore(performance: {,)
    averageResponseTime: number;,
    successRate: number;,
    userSatisfactionScore: number;,
    usageCount: number;
  }): number {
    // Weight factors
    const speedWeight = 0.3;
    const successWeight = 0.4;
    const satisfactionWeight = 0.3;

    // Normalize speed (lower is better, max 5000ms)
    const speedScore = Math.max(0, 1 - (performance.averageResponseTime / 5000));
    
    return (;
      speedScore * speedWeight +
      performance.successRate * successWeight +
      performance.userSatisfactionScore * satisfactionWeight
    );
  }

  /**
   * Select any available model as emergency fallback
   */
  private selectAnyAvailableModel(): ModelMetadata | null {
    const allModels = modelTierManager.getAllModels();
    const availableModels = allModels.filter(model => model.isAvailable);
    
    if (availableModels.length === 0) {
      return null;
    }

    return this.selectBestPerformingModel(availableModels);
  }

  /**
   * Get optimized parameters for the selected model
   */
  private async getOptimizedParameters()
    model: ModelMetadata,
    classification: ClassificationResult,
    request: RoutingRequest
  ): Promise<any> {
    try {
      // Use intelligent parameter service for optimization
      const taskContext = intelligentParameterService.createTaskContext();
        request.query,
        this.mapComplexityToTaskType(classification.complexity)
      );
      
      const baseParams = intelligentParameterService.getTaskParameters(taskContext);
      
      // Adjust parameters based on model tier and type
      const optimizedParams = this.adjustParametersForModel(baseParams, model, classification);
      
      return optimizedParams;
    } catch (error) {
      log.warn('Failed to get optimized parameters, using defaults', LogContext.AI, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        temperature: 0.7,
        maxTokens: 500,
        topP: 0.9
      };
    }
  }

  /**
   * Map query complexity to task type for parameter optimization
   */
  private mapComplexityToTaskType(complexity: QueryComplexity): any {
    // This maps to the TaskType enum from intelligent-parameter-service
    switch (complexity) {
      case QueryComplexity.SIMPLE: return 'FACTUAL_QA';';''
      case QueryComplexity.MEDIUM: return 'CASUAL_CONVERSATION';';''
      case QueryComplexity.COMPLEX: return 'REASONING';';''
      case QueryComplexity.EXPERT: return 'CODE_GENERATION';,';''
      default: return 'CASUAL_CONVERSATION';';''
    }
  }

  /**
   * Adjust parameters based on model characteristics
   */
  private adjustParametersForModel()
    baseParams: any,
    model: ModelMetadata,
    classification: ClassificationResult
  ): any {
    const params = { ...baseParams };

    // Adjust for model tier
    switch (model.tier) {
      case ModelTier.ULTRA_FAST: // Optimize for speed
        params.maxTokens = Math.min(params.maxTokens || 500, 200);
        params.temperature = Math.max(params.temperature || 0.7, 0.5); // Slightly more focused
        break;
        
      case ModelTier.POWERFUL: // Allow for more detailed responses
        params.maxTokens = Math.min(params.maxTokens || 500, 1000);
        params.temperature = params.temperature || 0.7; // Keep default
        break;
        
      case ModelTier.ROUTER: // Very focused for routing decisions
        params.maxTokens = Math.min(params.maxTokens || 100, 50);
        params.temperature = 0.3; // Very focused
        break;
    }

    // Adjust for model format
    if (model.format === 'mlx') {'''
      // MLX models can handle slightly higher token counts efficiently
      params.maxTokens = Math.min((params.maxTokens || 500) * 1.2, 800);
    }

    return params;
  }

  /**
   * Estimate response time based on model and query complexity
   */
  private estimateResponseTime(model: ModelMetadata, classification: ClassificationResult): number {
    let baseTime = model.averageInferenceTime || model.benchmarkResults?.avgResponseTime || 1000;
    
    // Adjust for query complexity
    const complexityMultipliers = {
      [QueryComplexity.SIMPLE]: 0.7,
      [QueryComplexity.MEDIUM]: 1.0,
      [QueryComplexity.COMPLEX]: 1.5,
      [QueryComplexity.EXPERT]: 2.0
    };
    
    baseTime *= complexityMultipliers[classification.complexity];
    
    // Add warmup time if model is not warm
    // In production, check if model is actually loaded
    if (!this.isModelWarm(model.id)) {
      baseTime += model.warmupTime || 2000;
    }
    
    return Math.round(baseTime);
  }

  /**
   * Check if model is currently warm (loaded in memory)
   */
  private isModelWarm(modelId: string): boolean {
    // In production, this would check actual model loading status
    // For now, simulate based on recent usage
    const performance = this.modelPerformanceHistory.get(modelId);
    if (!performance) return false;
    
    const timeSinceLastUse = Date.now() - performance.lastUsed.getTime();
    return timeSinceLastUse < 5 * 60 * 1000; // 5 minutes;
  }

  /**
   * Get fallback model for the selected model
   */
  private getFallbackModel()
    primaryModel: ModelMetadata, 
    classification: ClassificationResult
  ): ModelMetadata | null {
    // Try fallback tier first
    if (classification.fallbackTier) {
      const fallback = modelTierManager.getBestModelForTier(classification.fallbackTier);
      if (fallback && fallback.id !== primaryModel.id) {
        return fallback;
      }
    }

    // Try same tier, different model
    const sameTierModels = modelTierManager.getModelsInTier(primaryModel.tier!);
    const alternatives = sameTierModels.filter(m => m.id !== primaryModel.id && m.isAvailable);
    
    return alternatives.length > 0 ? alternatives[0] : null;
  }

  /**
   * Trigger predictive warming based on conversation patterns
   */
  private async triggerPredictiveWarming()
    request: RoutingRequest,
    classification: ClassificationResult,
    selectedModel: ModelMetadata
  ): Promise<string[]> {
    const warmingTriggered: string[] = [];
    
    // Get conversation context
    const userId = request.context?.userId || 'anonymous';';';';
    const conversation = this.conversationContexts.get(userId);
    
    // Predict escalation patterns
    if (this.shouldTriggerEscalationWarming(conversation, classification)) {
      const nextTier = this.getNextTier(selectedModel.tier!);
      if (nextTier) {
        const nextModel = modelTierManager.getBestModelForTier(nextTier);
        if (nextModel && !this.isModelWarm(nextModel.id)) {
          this.addToWarmingQueue(nextModel.id);
          warmingTriggered.push(`${nextModel.name} (${nextTier})`);
        }
      }
    }

    // Warm fallback model if available
    const fallbackModel = this.getFallbackModel(selectedModel, classification);
    if (fallbackModel && !this.isModelWarm(fallbackModel.id)) {
      this.addToWarmingQueue(fallbackModel.id);
      warmingTriggered.push(`${fallbackModel.name} (fallback)`);
    }

    // Multi-turn conversation warming
    if (conversation && conversation.queries.length >= 2) {
      // Warm balanced tier for extended conversations
      const balancedModel = modelTierManager.getBestModelForTier(ModelTier.BALANCED);
      if (balancedModel && !this.isModelWarm(balancedModel.id)) {
        this.addToWarmingQueue(balancedModel.id);
        warmingTriggered.push(`${balancedModel.name} (conversation)`);
      }
    }

    return warmingTriggered;
  }

  /**
   * Check if escalation warming should be triggered
   */
  private shouldTriggerEscalationWarming()
    conversation: ConversationContext | undefined,
    classification: ClassificationResult
  ): boolean {
    if (!conversation) return false;
    
    // Check for complexity progression
    const recentComplexities = conversation.complexityProgression.slice(-3);
    if (recentComplexities.length >= 2) {
      const isEscalating = this.isComplexityEscalating(recentComplexities);
      return isEscalating;
    }
    
    // Trigger if current query is complex but user started simple
    if (classification.complexity === QueryComplexity.COMPLEX ||
        classification.complexity === QueryComplexity.EXPERT) {
      const firstComplexity = conversation.complexityProgression[0];
      return firstComplexity === QueryComplexity.SIMPLE || 
             firstComplexity === QueryComplexity.MEDIUM;
    }
    
    return false;
  }

  /**
   * Check if complexity is escalating in recent queries
   */
  private isComplexityEscalating(complexities: QueryComplexity[]): boolean {
    const complexityOrder = [;
      QueryComplexity.SIMPLE,
      QueryComplexity.MEDIUM,
      QueryComplexity.COMPLEX,
      QueryComplexity.EXPERT
    ];
    
    for (let i = 1; i < complexities.length; i++) {
      const prevIndex = complexityOrder.indexOf(complexities[i - 1]);
      const currIndex = complexityOrder.indexOf(complexities[i]);
      if (currIndex <= prevIndex) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get next tier for escalation
   */
  private getNextTier(currentTier: ModelTier): ModelTier | null {
    const tierOrder = [;
      ModelTier.ULTRA_FAST,
      ModelTier.FAST,
      ModelTier.BALANCED,
      ModelTier.POWERFUL
    ];
    
    const currentIndex = tierOrder.indexOf(currentTier);
    return currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  }

  /**
   * Add model to warming queue
   */
  private addToWarmingQueue(modelId: string): void {
    this.warmingQueue.add(modelId);
  }

  /**
   * Background warming process
   */
  private startBackgroundWarming(): void {
    setInterval(async () => {
      if (this.isWarming || this.warmingQueue.size === 0) return;
      
      this.isWarming = true;
      try {
        const modelIds = Array.from(this.warmingQueue).slice(0, 2); // Warm 2 at a time;
        
        for (const modelId of modelIds) {
          await this.warmModel(modelId);
          this.warmingQueue.delete(modelId);
        }
        
      } catch (error) {
        log.error('Background warming failed', LogContext.AI, {')''
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        this.isWarming = false;
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Warm a specific model
   */
  private async warmModel(modelId: string): Promise<void> {
    const model = modelTierManager.getModel(modelId);
    if (!model) return;
    
    log.info('🔥 Warming model', LogContext.AI, { name: model.name });'''
    
    // In production, this would actually load the model
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update performance tracking
    let performance = this.modelPerformanceHistory.get(modelId);
    if (!performance) {
      performance = {
        averageResponseTime: model.benchmarkResults?.avgResponseTime || 1000,
        successRate: 1.0,
        userSatisfactionScore: 0.8,
        lastUsed: new Date(),
        usageCount: 0
      };
    }
    performance.lastUsed = new Date();
    this.modelPerformanceHistory.set(modelId, performance);
  }

  /**
   * Update conversation context
   */
  private updateConversationContext()
    request: RoutingRequest,
    classification: ClassificationResult,
    selectedModel: ModelMetadata
  ): void {
    const userId = request.context?.userId || 'anonymous';';';';
    
    let context = this.conversationContexts.get(userId);
    if (!context) {
      context = {
        userId,
        queries: [],
        complexityProgression: [],
        modelsUsed: [],
        averageResponseTime: 0,
        userSatisfaction: 0.8,
        predictedEscalation: false
      };
    }
    
    // Update context
    context.queries.push(request.query);
    context.complexityProgression.push(classification.complexity);
    context.modelsUsed.push(selectedModel.id);
    
    // Keep only recent history
    if (context.queries.length > 10) {
      context.queries = context.queries.slice(-10);
      context.complexityProgression = context.complexityProgression.slice(-10);
      context.modelsUsed = context.modelsUsed.slice(-10);
    }
    
    this.conversationContexts.set(userId, context);
  }

  /**
   * Generate routing reasoning
   */
  private generateRoutingReasoning()
    model: ModelMetadata,
    classification: ClassificationResult
  ): string {
    const reasons = [;
      `Selected ${model.name} (${model.tier} tier)`,
      `Query classified as ${classification.complexity}`,
      `Confidence: ${Math.round(classification.confidence * 100)}%`
    ];
    
    if (model.benchmarkResults) {
      reasons.push(`Avg response: ${model.benchmarkResults.avgResponseTime}ms`);
    }
    
    return reasons.join(' • ');';';';
  }

  /**
   * Report model performance after execution
   */
  public reportModelPerformance()
    modelId: string,
    responseTime: number,
    success: boolean,
    userSatisfaction?: number
  ): void {
    let performance = this.modelPerformanceHistory.get(modelId);
    if (!performance) {
      performance = {
        averageResponseTime: responseTime,
        successRate: success ? 1.0 : 0.0,
        userSatisfactionScore: userSatisfaction || 0.8,
        lastUsed: new Date(),
        usageCount: 1
      };
    } else {
      // Update running averages
      const weight = 1 / (performance.usageCount + 1);
      performance.averageResponseTime = 
        performance.averageResponseTime * (1 - weight) + responseTime * weight;
      performance.successRate = 
        performance.successRate * (1 - weight) + (success ? 1: 0) * weight;
      
      if (userSatisfaction !== undefined) {
        performance.userSatisfactionScore = 
          performance.userSatisfactionScore * (1 - weight) + userSatisfaction * weight;
      }
      
      performance.lastUsed = new Date();
      performance.usageCount++;
    }
    
    this.modelPerformanceHistory.set(modelId, performance);
  }

  /**
   * Get routing statistics
   */
  public getStatistics(): any {
    return {
      conversationsActive: this.conversationContexts.size,
      modelsTracked: this.modelPerformanceHistory.size,
      warmingQueueSize: this.warmingQueue.size,
      isWarming: this.isWarming
    };
  }
}

// Singleton instance
export const intelligentModelRouter = new IntelligentModelRouter();