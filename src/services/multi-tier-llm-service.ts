/**
 * Multi-Tier LLM Service - Agent Zero Competitor
 * Uses local models in a hierarchical system for maximum speed and capability
 * Tier 1: LFM2-1.2B (routing, coordination, simple Q&A)
 * Tier 2: Small models (Gemma 2B, Phi 2.7B) for medium tasks
 * Tier 3: Large models (Qwen 7B, DeepSeek R1 14B, Devstral 24B) for complex tasks
 * Tier 4: External APIs (fallback only)
 */

import { THREE } from '@/utils/constants';
import { log,LogContext } from '@/utils/logger';

import { lfm2Bridge } from './lfm2-bridge';
import { ollamaService } from './ollama-service';

export interface ModelTier {
  tier: 1 | 2 | 3 | 4;
  models: string[];
  capabilities: string[];
  maxTokens: number;
  avgResponseTime: number;
  useCase: string;
}

export interface TaskClassification {
  complexity: 'simple' | 'medium' | 'complex' | 'expert';
  domain: 'general' | 'code' | 'reasoning' | 'creative' | 'multimodal';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  estimatedTokens: number;
  requiresAccuracy: boolean;
  requiresSpeed: boolean;
}

export interface ExecutionPlan {
  primaryModel: string;
  fallbackModels: string[];
  tier: number;
  estimatedTime: number;
  confidence: number;
  reasoning: string;
}

export class MultiTierLLMService {
  private modelTiers: Map<number, ModelTier> = new Map();
  private modelPerformance: Map<
    string,
    {
      avgResponseTime: number;
      successRate: number;
      tokenThroughput: number;
      lastUsed: number;
    }
  > = new Map();

  constructor() {
    this.initializeModelTiers();
    this.startPerformanceMonitoring();
  }

  private initializeModelTiers(): void {
    // Tier 1: Lightning-fast routing & coordination (50-200ms)
    this.modelTiers.set(1, {
      tier: 1,
      models: ['lfm2-1.2b'], // Your local LFM2
      capabilities: ['routing', 'coordination', 'classification', 'simple_qa'],
      maxTokens: 256,
      avgResponseTime: 100,
      useCase: 'Instant decisions, routing, simple questions',
    });

    // Initialize basic fallback tiers immediately to prevent undefined access
    this.initializeFallbackTiers();

    // Auto-discover available models and populate tiers (async in background)
    this.populateAvailableModels().catch(error => {
      log.warn('Failed to populate available models, using fallback configuration', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    log.info('🏗️ Multi-tier LLM architecture initialized', LogContext.AI, {
      tiers: Array.from(this.modelTiers.keys()),
      totalModels: Array.from(this.modelTiers.values()).reduce(
        (sum, tier) => sum + tier.models.length,
        0
      ),
    });
  }

  private initializeFallbackTiers(): void {
    // Initialize minimal fallback tiers to prevent undefined access
    if (!this.modelTiers.has(2)) {
      this.modelTiers.set(2, {
        tier: 2,
        models: ['llama3.2:3b'], // Common default model
        capabilities: ['conversation', 'basic_analysis', 'summarization', 'simple_code'],
        maxTokens: 1024,
        avgResponseTime: 500,
        useCase: 'General conversation, basic tasks, quick analysis',
      });
    }

    if (!this.modelTiers.has(3)) {
      this.modelTiers.set(3, {
        tier: 3,
        models: ['llama3.2:3b'], // Fallback to same model
        capabilities: ['advanced_reasoning', 'code_generation', 'complex_analysis', 'research'],
        maxTokens: 4096,
        avgResponseTime: 2500,
        useCase: 'Complex reasoning, code generation, detailed analysis',
      });
    }

    if (!this.modelTiers.has(4)) {
      this.modelTiers.set(4, {
        tier: 4,
        models: ['llama3.2:3b'], // Fallback to same model
        capabilities: ['expert_analysis', 'complex_code', 'research', 'creative_writing'],
        maxTokens: 8192,
        avgResponseTime: 8000,
        useCase: 'Expert-level tasks, complex code, research, creative work',
      });
    }
  }

  private async populateAvailableModels(): Promise<void> {
    try {
      // Get available models from Ollama
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      const availableModels = data.models?.map((m: any) => m.name) || [];

      // Categorize models by size/capability (heuristic-based)
      const fastModels = availableModels.filter((name: string) => 
        name.includes('tiny') || name.includes('1b') || name.includes('2b') || 
        name.includes('small') || name.includes('mini')
      );
      
      const mediumModels = availableModels.filter((name: string) => 
        name.includes('7b') || name.includes('8b') || name.includes('13b') ||
        (name.includes('3b') && !fastModels.includes(name))
      );
      
      const largeModels = availableModels.filter((name: string) => 
        name.includes('20b') || name.includes('24b') || name.includes('70b') ||
        name.includes('large') || name.includes('xl')
      );

      // Fallback: if no categorization matches, put all models in medium tier
      const uncategorized = availableModels.filter((name: string) => 
        !fastModels.includes(name) && !mediumModels.includes(name) && !largeModels.includes(name)
      );

      // Populate Tier 2 with fast models
      if (fastModels.length > 0 || uncategorized.length > 0) {
        this.modelTiers.set(2, {
          tier: 2,
          models: fastModels.length > 0 ? fastModels : uncategorized.slice(0, 1),
          capabilities: ['conversation', 'basic_analysis', 'summarization', 'simple_code'],
          maxTokens: 1024,
          avgResponseTime: 500,
          useCase: 'General conversation, basic tasks, quick analysis',
        });
      }

      // Populate Tier 3 with medium models 
      if (mediumModels.length > 0 || (uncategorized.length > 1)) {
        this.modelTiers.set(3, {
          tier: 3,
          models: mediumModels.length > 0 ? mediumModels : uncategorized.slice(1),
          capabilities: ['advanced_reasoning', 'code_generation', 'complex_analysis', 'research'],
          maxTokens: 4096,
          avgResponseTime: 2500,
          useCase: 'Complex reasoning, code generation, detailed analysis',
        });
      }

      // Populate Tier 4 with large models
      if (largeModels.length > 0) {
        this.modelTiers.set(4, {
          tier: 4,
          models: largeModels,
          capabilities: ['expert_analysis', 'complex_code', 'research', 'creative_writing'],
          maxTokens: 8192,
          avgResponseTime: 8000,
          useCase: 'Expert-level tasks, complex code, research, creative work',
        });
      }

      log.info('🔍 Auto-discovered models', LogContext.AI, {
        available: availableModels.length,
        fast: fastModels.length,
        medium: mediumModels.length,
        large: largeModels.length,
        uncategorized: uncategorized.length
      });

    } catch (error) {
      log.warn('⚠️ Could not auto-discover models, using fallback configuration', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback configuration with generic model names
      this.modelTiers.set(2, {
        tier: 2,
        models: ['local-model-fast'],
        capabilities: ['conversation', 'basic_analysis'],
        maxTokens: 1024,
        avgResponseTime: 500,
        useCase: 'Fast general purpose',
      });
      
      this.modelTiers.set(3, {
        tier: 3,
        models: ['local-model-medium'],
        capabilities: ['advanced_reasoning', 'code_generation'],
        maxTokens: 4096,
        avgResponseTime: 2500,
        useCase: 'Advanced reasoning',
      });
    }
  }

  /**
   * Classify task and determine optimal execution plan
   */
  public async classifyAndPlan(
    userRequest: string,
    context: Record<string, any> = {}
  ): Promise<{
    classification: TaskClassification;
    plan: ExecutionPlan;
  }> {
    const startTime = Date.now();

    // Use LFM2 for fast task classification
    const classification = await this.classifyTask(userRequest, context);
    const plan = await this.createExecutionPlan(classification, userRequest);

    const classificationTime = Date.now() - startTime;

    log.info('🎯 Task classified and planned', LogContext.AI, {
      complexity: classification.complexity,
      domain: classification.domain,
      tier: plan.tier,
      primaryModel: plan.primaryModel,
      classificationTime: `${classificationTime}ms`,
    });

    return { classification, plan };
  }

  /**
   * Execute request using optimal model tier
   */
  public async execute(
    userRequest: string,
    context: Record<string, any> = {}
  ): Promise<{
    response: string;
    metadata: {
      modelUsed: string;
      tier: number;
      executionTime: number;
      tokensUsed: number;
      classification: TaskClassification;
      fallbackUsed: boolean;
    };
  }> {
    const startTime = Date.now();

    // Step 1: Classify and plan (using LFM2 - ~100ms)
    const { classification, plan } = await this.classifyAndPlan(userRequest, context);

    // Step 2: Execute with primary model
    let response = '';
    let modelUsed: string = plan.primaryModel;
    let tokensUsed = 0;
    let fallbackUsed = false;

    try {
      if (plan.tier === 1) {
        // Use LFM2 directly
        const lfm2Response = await lfm2Bridge.quickResponse(userRequest, 'simple_qa');
        response = lfm2Response.content;
        modelUsed = 'lfm2-1.2b';
        tokensUsed = lfm2Response.tokens;
      } else {
        // Use Ollama models for tiers 2-4
        const tierConfig = this.modelTiers.get(plan.tier);
        const maxTokens = tierConfig?.maxTokens || 2048;
        
        const ollamaResponse = await ollamaService.generateResponse(
          [{ role: 'user', content: userRequest }],
          plan.primaryModel,
          {
            temperature: this.getOptimalTemperature(classification.domain),
            max_tokens: maxTokens,
          }
        );
        response = ollamaResponse.message.content;
        modelUsed = plan.primaryModel;
        tokensUsed = ollamaResponse.eval_count || 0;
      }

      // Update performance metrics
      this.updateModelPerformance(modelUsed, Date.now() - startTime, true, tokensUsed);
    } catch (error) {
      log.warn(`⚠️ Primary model ${plan.primaryModel} failed, trying fallback`, LogContext.AI);

      // Try fallback models
      for (const fallbackModel of plan.fallbackModels) {
        try {
          const fallbackResponse = await ollamaService.generateResponse(
            [{ role: 'user', content: userRequest }],
            fallbackModel
          );
          response = fallbackResponse.message.content;
          modelUsed = fallbackModel;
          tokensUsed = fallbackResponse.eval_count || 0;
          fallbackUsed = true;
          break;
        } catch (fallbackError) {
          log.warn(`⚠️ Fallback model ${fallbackModel} also failed`, LogContext.AI);
          continue;
        }
      }

      if (!response!) {
        throw new Error(`All models failed for request: ${userRequest.substring(0, 50)}...`);
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      response,
      metadata: {
        modelUsed,
        tier: plan.tier,
        executionTime,
        tokensUsed,
        classification,
        fallbackUsed,
      },
    };
  }

  /**
   * Parallel execution across multiple tiers
   */
  public async executeParallel(
    requests: Array<{
      request: string;
      priority: 'low' | 'medium' | 'high';
      context?: Record<string, any>;
    }>
  ): Promise<
    Array<{
      request: string;
      response: string;
      metadata: unknown;
      index: number;
    }>
  > {
    log.info('🚀 Starting parallel execution', LogContext.AI, { requests: requests.length });

    // Sort by priority and classify all requests quickly using LFM2
    const sortedRequests = requests
      .map((req, index) => ({ ...req, index }))
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    // Execute in parallel with controlled concurrency
    const results = await this.executeWithConcurrencyControl(sortedRequests);

    return results.sort((a, b) => a.index - b.index); // Return in original order
  }

  /**
   * Adaptive model selection based on current system load
   */
  public async adaptiveExecute(
    userRequest: string,
    context: Record<string, any> = {}
  ): Promise<any> {
    // Check current system load and model availability
    const systemLoad = await this.getCurrentSystemLoad();
    const _availableModels = await this.getAvailableModels();

    // Adjust tier selection based on load
    const { classification, plan } = await this.classifyAndPlan(userRequest, context);

    if (systemLoad > 0.8) {
      // High load - prefer faster models
      const newTier = Math.max(1, plan.tier - 1);
      const tierConfig = this.modelTiers.get(newTier);
      if (tierConfig && tierConfig.models && tierConfig.models.length > 0) {
        plan.tier = newTier;
        plan.primaryModel = tierConfig.models[0] || 'default-model';
      }
    }

    return this.execute(userRequest, context);
  }

  private async classifyTask(
    userRequest: string,
    context: Record<string, any>
  ): Promise<TaskClassification> {
    // Use LFM2 for fast classification
    const classificationPrompt = `Classify this task quickly:

REQUEST: "${userRequest}"
CONTEXT: ${JSON.stringify(context)}

Respond with JSON:
{
  "complexity": "simple|medium|complex|expert",
  "domain": "general|code|reasoning|creative|multimodal", 
  "urgency": "low|medium|high|critical",
  "estimatedTokens": number,
  "requiresAccuracy": boolean,
  "requiresSpeed": boolean
}`;

    try {
      const response = await lfm2Bridge.quickResponse(classificationPrompt, 'classification');
      const parsed = JSON.parse(response.content);

      return {
        complexity: parsed.complexity || 'medium',
        domain: parsed.domain || 'general',
        urgency: parsed.urgency || 'medium',
        estimatedTokens: parsed.estimatedTokens || 150,
        requiresAccuracy: parsed.requiresAccuracy !== false,
        requiresSpeed: parsed.requiresSpeed !== false,
      };
    } catch (error) {
      // Fallback classification based on heuristics
      return this.heuristicClassification(userRequest);
    }
  }

  private async createExecutionPlan(
    classification: TaskClassification,
    userRequest: string
  ): Promise<ExecutionPlan> {
    // Determine optimal tier based on classification
    let optimalTier = 2; // Default to tier 2

    if (classification.complexity === 'simple' && classification.requiresSpeed) {
      optimalTier = 1;
    } else if (classification.complexity === 'medium') {
      optimalTier = 2;
    } else if (classification.complexity === 'complex') {
      optimalTier = THREE;
    } else if (classification.complexity === 'expert') {
      optimalTier = 4;
    }

    // Adjust for domain-specific requirements
    if (classification.domain === 'code' && classification.complexity !== 'simple') {
      optimalTier = Math.max(optimalTier, THREE); // Code tasks need at least tier 3
    }

    // Ensure the tier exists, fallback to available tiers
    let tierConfig = this.modelTiers.get(optimalTier);
    if (!tierConfig) {
      // Find the highest available tier
      const availableTiers = Array.from(this.modelTiers.keys()).sort((a, b) => b - a);
      optimalTier = availableTiers[0] || 1;
      tierConfig = this.modelTiers.get(optimalTier);
    }
    
    // Final safety check
    if (!tierConfig) {
      throw new Error(`No model tiers available for execution`);
    }

    const primaryModel = this.selectBestModelFromTier(optimalTier);
    const fallbackModels = this.getFallbackModels(optimalTier);

    return {
      primaryModel,
      fallbackModels,
      tier: optimalTier,
      estimatedTime: tierConfig.avgResponseTime,
      confidence: 0.85,
      reasoning: `Tier ${optimalTier} selected for ${classification.complexity} ${classification.domain} task`,
    };
  }

  private selectBestModelFromTier(tier: number): string {
    const tierConfig = this.modelTiers.get(tier);
    
    if (!tierConfig || !tierConfig.models || tierConfig.models.length === 0) {
      // Fallback to any available model from any tier
      for (const [_, config] of this.modelTiers) {
        if (config.models && config.models.length > 0) {
          return config.models[0] || 'llama3.2:3b';
        }
      }
      // Ultimate fallback
      return 'llama3.2:3b';
    }

    // Select model based on recent performance
    let bestModel = tierConfig.models[0] || 'llama3.2:3b';
    let bestScore = 0;

    for (const model of tierConfig.models) {
      const perf = this.modelPerformance.get(model);
      if (perf) {
        // Score based on success rate and speed (recency weighted)
        const recencyWeight = Math.max(0.1, 1 - (Date.now() - perf.lastUsed) / (1000 * 60 * 60)); // 1 hour decay
        const score = (perf.successRate * 0.7 + (1 / perf.avgResponseTime) * 0.3) * recencyWeight;

        if (score > bestScore) {
          bestScore = score;
          bestModel = model;
        }
      }
    }

    return bestModel;
  }

  private getFallbackModels(tier: number): string[] {
    const fallbacks: string[] = [];

    // Add other models from same tier
    const currentTier = this.modelTiers.get(tier);
    if (currentTier && currentTier.models && currentTier.models.length > 1) {
      fallbacks.push(...currentTier.models.slice(1));
    }

    // Add models from lower tiers as last resort
    if (tier > 1) {
      const lowerTier = this.modelTiers.get(tier - 1);
      if (lowerTier && lowerTier.models) {
        fallbacks.push(...lowerTier.models);
      }
    }

    // If no fallbacks found, collect any available models from any tier
    if (fallbacks.length === 0) {
      for (const [_, config] of this.modelTiers) {
        if (config.models) {
          fallbacks.push(...config.models);
        }
      }
    }

    // Remove duplicates and return unique fallbacks
    return [...new Set(fallbacks)];
  }

  private heuristicClassification(userRequest: string): TaskClassification {
    const { length } = userRequest;
    const codeKeywords = ['code', 'function', 'class', 'import', 'def', 'const', 'let', 'var'];
    const complexKeywords = ['analyze', 'research', 'explain in detail', 'comprehensive'];

    let complexity: TaskClassification['complexity'] = 'medium';
    let domain: TaskClassification['domain'] = 'general';

    if (length < 50) complexity = 'simple';
    else if (length > 200 || complexKeywords.some((k) => userRequest.toLowerCase().includes(k)))
      {complexity = 'complex';}

    if (codeKeywords.some((k) => userRequest.toLowerCase().includes(k))) domain = 'code';

    return {
      complexity,
      domain,
      urgency: 'medium',
      estimatedTokens: Math.min(Math.max(length / 4, 50), 500),
      requiresAccuracy: true,
      requiresSpeed: complexity === 'simple',
    };
  }

  private getOptimalTemperature(domain: string): number {
    const temperatureMap = {
      code: 0.2,
      reasoning: 0.3,
      general: 0.7,
      creative: 0.9,
      multimodal: 0.5,
    };
    return temperatureMap[domain as keyof typeof temperatureMap] || 0.7;
  }

  private async executeWithConcurrencyControl(requests: Array<any>): Promise<any[]> {
    const maxConcurrency = 4; // Limit concurrent requests
    const results: unknown[] = [];

    for (let i = 0; i < requests.length; i += maxConcurrency) {
      const batch = requests.slice(i, i + maxConcurrency);
      const batchResults = await Promise.allSettled(
        batch.map(async (req) => {
          try {
            const result = await this.execute(req.request, req.context || {});
            return {
              request: req.request,
              response: result.response,
              metadata: result.metadata,
              index: req.index,
            };
          } catch (error) {
            return {
              request: req.request,
              response: `Error: ${error}`,
              metadata: { error: true },
              index: req.index,
            };
          }
        })
      );

      results.push(...batchResults.map((r) => (r.status === 'fulfilled' ? r.value : r.reason)));
    }

    return results;
  }

  private updateModelPerformance(
    model: string,
    responseTime: number,
    success: boolean,
    tokens: number
  ): void {
    const existing = this.modelPerformance.get(model) || {
      avgResponseTime: responseTime,
      successRate: success ? 1 : 0,
      tokenThroughput: tokens / (responseTime / 1000),
      lastUsed: Date.now(),
    };

    // Exponential moving average
    const alpha = 0.2;
    existing.avgResponseTime = alpha * responseTime + (1 - alpha) * existing.avgResponseTime;
    existing.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * existing.successRate;
    existing.tokenThroughput =
      alpha * (tokens / (responseTime / 1000)) + (1 - alpha) * existing.tokenThroughput;
    existing.lastUsed = Date.now();

    this.modelPerformance.set(model, existing);
  }

  private async getCurrentSystemLoad(): Promise<number> {
    // Simple load calculation based on active requests and system metrics
    // In a real implementation, you'd check CPU, memory, etc.
    return Math.random() * 0.5; // Mock for now
  }

  private async getAvailableModels(): Promise<string[]> {
    try {
      const models = await ollamaService.getAvailableModels();
      return models;
    } catch (error) {
      return ['llama3.2:3b']; // Fallback
    }
  }

  private startPerformanceMonitoring(): void {
    // Monitor model performance every 5 minutes
    setInterval(
      () => {
        log.info('📊 Model performance update', LogContext.AI, {
          modelsTracked: this.modelPerformance.size,
          avgPerformance: this.getAveragePerformance(),
        });
      },
      5 * 60 * 1000
    );
  }

  private getAveragePerformance(): Record<string, number> {
    const performances = Array.from(this.modelPerformance.values());
    if (performances.length === 0) return {};

    const avg = performances.reduce(
      (acc, perf) => ({
        responseTime: acc.responseTime + perf.avgResponseTime,
        successRate: acc.successRate + perf.successRate,
        throughput: acc.throughput + perf.tokenThroughput,
      }),
      { responseTime: 0, successRate: 0, throughput: 0 }
    );

    return {
      avgResponseTime: avg.responseTime / performances.length,
      avgSuccessRate: avg.successRate / performances.length,
      avgThroughput: avg.throughput / performances.length,
    };
  }

  public getSystemStatus(): {
    tiers: Array<{ tier: number; models: string[]; avgResponseTime: number }>;
    performance: Record<string, any>;
    totalModels: number;
  } {
    return {
      tiers: Array.from(this.modelTiers.entries()).map(([tier, config]) => ({
        tier,
        models: config.models,
        avgResponseTime: config.avgResponseTime,
      })),
      performance: this.getAveragePerformance(),
      totalModels: Array.from(this.modelTiers.values()).reduce(
        (sum, tier) => sum + tier.models.length,
        0
      ),
    };
  }
}

// Singleton instance
export const multiTierLLM = new MultiTierLLMService();
export default multiTierLLM;
