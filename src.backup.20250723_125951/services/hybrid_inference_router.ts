/**
 * Hybrid Inference Router
 * Intelligently routes inference requests between MLX and Ollama based on requirements
 */

import { EventEmitter } from 'events';
import { EmbeddedModelManager } from './embedded_model_manager';
import { ModelLifecycleManager } from './model_lifecycle_manager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface InferenceRequest {
  prompt: string;
  modelPreference?: string;
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface InferenceResponse {
  text: string;
  model: string;
  engine: 'mlx' | 'ollama' | 'hybrid';
  tokensPerSecond?: number;
  totalTokens?: number;
  latencyMs: number;
  confidence?: number;
}

interface RoutingDecision {
  engine: 'mlx' | 'ollama' | 'hybrid';
  model: string;
  reasoning: string;
  complexity: number;
  needsSpeed: boolean;
  needsStreaming: boolean;
  isMultimodal: boolean;
  modelSize: number;
}

interface PerformanceStats {
  mlx: {
    totalRequests: number;
    averageLatency: number;
    successRate: number;
  };
  ollama: {
    totalRequests: number;
    averageLatency: number;
    successRate: number;
  };
}

export class HybridInferenceRouter extends EventEmitter {
  private embeddedManager: EmbeddedModelManager;
  private lifecycleManager: ModelLifecycleManager;
  private performanceStats: PerformanceStats;
  private routingCache: Map<string, RoutingDecision> = new Map();

  constructor(embeddedManager?: EmbeddedModelManager, lifecycleManager?: ModelLifecycleManager {
    super();

    this.embeddedManager = embeddedManager || new EmbeddedModelManager();
    this.lifecycleManager = lifecycleManager || new ModelLifecycleManager();

    this.performanceStats = {
      mlx: { totalRequests: 0, averageLatency: 0, successRate: 1.0 },
      ollama: { totalRequests: 0, averageLatency: 0, successRate: 1.0 },
    };
  }

  /**
   * Route inference request to optimal engine
   */
  async route(request: InferenceRequest: Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      // Analyze request to determine routing
      const routing = await this.analyzeRequest(request;

      // Log routing decision
      this.emit('routing-decision', {
        request requestprompt.substring(0, 100),
        decision: routing,
      });

      let response: InferenceResponse;

      // Execute based on routing decision
      switch (routing.engine) {
        case 'mlx':
          response = await this.mlxInference(request: routing;
          break;

        case 'ollama':
          response = await this.ollamaInference(request: routing;
          break;

        case 'hybrid':
          response = await this.hybridInference(request: routing;
          break;

        default:
          response = await this.selectOptimalEngine(request: routing;
      }

      // Update stats
      this.updatePerformanceStats(routing.engine, Date.now() - startTime, true;

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.emit('routing-_error, { _error latency });
      throw error;
    }
  }

  /**
   * Analyze request to determine optimal routing
   */
  private async analyzeRequest(request: InferenceRequest: Promise<RoutingDecision> {
    // Check cache first
    const cacheKey = this.generateCacheKey(request;
    const cached = this.routingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Analyze requestcharacteristics
    const complexity = this.assessComplexity(requestprompt);
    const needsSpeed =;
      requestpriority === 'critical' || (requesttimeout !== undefined && requesttimeout < 5000);
    const needsStreaming = requeststreaming || false;
    const isMultimodal = this.detectMultimodal(requestprompt);
    const modelSize = this.estimateRequiredModelSize(complexity, requestprompt;

    // Determine optimal engine
    let engine: 'mlx' | 'ollama' | 'hybrid';
    let model: string;
    let reasoning: string;

    if (needsSpeed && modelSize < 4e9) {
      engine = 'mlx';
      model = this.selectMLXModel(modelSize);
      reasoning = 'Fast response needed with small model';
    } else if (needsStreaming || isMultimodal) {
      engine = 'ollama';
      model = this.selectOllamaModel(modelSize, isMultimodal;
      reasoning = 'Streaming or multimodal capabilities required';
    } else if (complexity > 8) {
      engine = 'hybrid';
      model = 'deepseek-r1:14b';
      reasoning = 'Complex task requiring multi-stage processing';
    } else {
      // Default: choose based on performance stats
      engine = this.selectOptimalEngineByStats();
      model = this.selectModelBySize(modelSize, engine;
      reasoning = 'Selected based on performance history';
    }

    const decision: RoutingDecision = {
      engine,
      model,
      reasoning,
      complexity,
      needsSpeed,
      needsStreaming,
      isMultimodal,
      modelSize,
    };

    // Cache decision
    this.routingCache.set(cacheKey, decision;

    // Clear old cache entries
    if (this.routingCache.size > 1000) {
      const firstKey = this.routingCache.keys().next().value;
      if (firstKey !== undefined) {
        this.routingCache.delete(firstKey);
      }
    }

    return decision;
  }

  /**
   * MLX inference
   */
  private async mlxInference(
    request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    // Ensure model is embedded
    if (!(await this.isModelEmbedded(routing.model))) {
      await this.embeddedManager.embedModel(routing.model);
    }

    const text = await this.embeddedManager.generate(
      routing.model,
      requestprompt,
      requestmaxTokens || 100
    );

    return {
      text,
      model: routing.model,
      engine: 'mlx',
      latencyMs: Date.now() - startTime,
      tokensPerSecond: this.calculateTokensPerSecond(text, Date.now() - startTime),
    };
  }

  /**
   * Ollama inference
   */
  private async ollamaInference(
    request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    // Use lifecycle manager to ensure model is ready
    await this.lifecycleManager.predictAndWarm({ userRequest: requestprompt, });

    const command = this.buildOllamaCommand(routing.model, request;
    const { stdout } = await execAsync(command);

    return {
      text: stdout.trim(),
      model: routing.model,
      engine: 'ollama',
      latencyMs: Date.now() - startTime,
      tokensPerSecond: this.calculateTokensPerSecond(stdout, Date.now() - startTime),
    };
  }

  /**
   * Hybrid inference using multiple models
   */
  private async hybridInference(
    request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    // Step 1: Use small MLX model for planning
    const planningModel = 'phi:2.7b';
    await this.embeddedManager.embedModel(planningModel);

    const plan = await this.embeddedManager.generate(
      planningModel,
      `Plan approach for ${requestprompt}`,
      50
    );

    // Step 2: Determine execution engine based on plan
    const executionComplexity = this.assessComplexity(plan);
    const executionEngine = executionComplexity > 7 ? 'ollama' : 'mlx';

    // Step 3: Execute with appropriate engine
    let finalResponse: string;
    if (executionEngine === 'ollama') {
      const { stdout } = await execAsync(
        this.buildOllamaCommand(routing.model, {
          ...request
          prompt: `${plan}\n\nNow execute: ${requestprompt}`,
        })
      );
      finalResponse = stdout.trim();
    } else {
      finalResponse = await this.embeddedManager.generate(
        'qwen2.5:7b',
        `${plan}\n\nNow execute: ${requestprompt}`,
        requestmaxTokens || 100
      );
    }

    return {
      text: finalResponse,
      model: `${planningModel}+${routing.model}`,
      engine: 'hybrid',
      latencyMs: Date.now() - startTime,
      confidence: 0.9, // Higher confidence due to multi-stage processing
    };
  }

  /**
   * Select optimal engine based on current conditions
   */
  private async selectOptimalEngine(
    request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    // Compare current performance stats
    const mlxScore = this.calculateEngineScore('mlx');
    const ollamaScore = this.calculateEngineScore('ollama');

    if (mlxScore > ollamaScore && routing.modelSize < 8e9) {
      return this.mlxInference(request: routing;
    } else {
      return this.ollamaInference(request: routing;
    }
  }

  /**
   * Assess prompt complexity
   */
  private assessComplexity(prompt: string: number {
    let complexity = 0;

    // Length factor
    complexity += Math.min(prompt.length / 100, 3);

    // Technical terms
    const technicalTerms = ['algorithm', 'implement', 'analyze', 'optimize', 'architecture'];
    complexity += technicalTerms.filter((term) => prompt.toLowerCase().includes(term)).length * 0.5;

    // Multi-step indicators
    const multiStepIndicators = ['first', 'then', 'finally', 'step', 'phase'];
    complexity += multiStepIndicators.filter((term) => prompt.toLowerCase().includes(term)).length;

    // Code detection
    if (prompt.includes('```') || prompt.includes('function') || prompt.includes('class')) {`
      complexity += 2;
    }

    return Math.min(complexity, 10);
  }

  /**
   * Detect if requestneeds multimodal capabilities
   */
  private detectMultimodal(prompt: string): boolean {
    const multimodalIndicators = ['image', 'picture', 'photo', 'diagram', 'chart', 'video'];
    return multimodalIndicators.some((indicator) => prompt.toLowerCase().includes(indicator));
  }

  /**
   * Estimate required model size based on task
   */
  private estimateRequiredModelSize(complexity: number, prompt: string: number {
    if (complexity < 3) return 2e9; // 2B
    if (complexity < 5) return 7e9; // 7B
    if (complexity < 8) return 14e9; // 14B
    return 24e9; // 24B+
  }

  /**
   * Select MLX model based on size requirements
   */
  private selectMLXModel(size: number: string {
    if (size <= 2e9) return 'gemma:2b';
    if (size <= 3e9) return 'phi:2.7b';
    return 'qwen2.5:7b'; // Largest we'll embed
  }

  /**
   * Select Ollama model based on requirements
   */
  private selectOllamaModel(size: number, isMultimodal: boolean: string {
    if (isMultimodal) return 'llava:7b';
    if (size <= 7e9) return 'qwen2.5:7b';
    if (size <= 14e9) return 'deepseek-r1:14b';
    return 'devstral:24b';
  }

  /**
   * Select optimal engine based on performance stats
   */
  private selectOptimalEngineByStats(): 'mlx' | 'ollama' {
    const mlxScore = this.calculateEngineScore('mlx');
    const ollamaScore = this.calculateEngineScore('ollama');
    return mlxScore > ollamaScore ? 'mlx' : 'ollama';
  }

  /**
   * Calculate engine performance score
   */
  private calculateEngineScore(engine: 'mlx' | 'ollama'): number {
    const stats = this.performanceStats[engine];
    if (stats.totalRequests === 0) return 0.5;

    // Weighted score: success rate (60%) + speed (40%)
    const speedScore = Math.max(0, 1 - stats.averageLatency / 10000); // 10s max
    return stats.successRate * 0.6 + speedScore * 0.4;
  }

  /**
   * Select model by size and engine
   */
  private selectModelBySize(size: number, engine: 'mlx' | 'ollama'): string {
    if (engine === 'mlx') {
      return this.selectMLXModel(size);
    } else {
      return this.selectOllamaModel(size, false;
    }
  }

  /**
   * Check if model is embedded
   */
  private async isModelEmbedded(model: string: Promise<boolean> {
    const status = this.embeddedManager.getModelStatus();
    return model in status;
  }

  /**
   * Build Ollama command
   */
  private buildOllamaCommand(model: string, request: InferenceRequest: string {
    const args = [
      `ollama run ${model}`,
      requestmaxTokens ? `--max-tokens ${requestmaxTokens}` : '',`
      requesttemperature ? `--temperature ${requesttemperature}` : '',`
    ]
      .filter(Boolean)
      .join(' ');

    return `echo "${requestprompt.replace(/"/g, '\\"')}" | ${args}`;
  }

  /**
   * Calculate tokens per second
   */
  private calculateTokensPerSecond(text: string, latencyMs: number: number {
    const tokens = text.split(/\s+/).length;
    const seconds = latencyMs / 1000;
    return tokens / seconds;
  }

  /**
   * Generate cache key for routing decisions
   */
  private generateCacheKey(request: InferenceRequest: string {
    const key = `${requestprompt.substring(0, 50)}_${requestmaxTokens}_${requeststreaming}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(
    engine: 'mlx' | 'ollama' | 'hybrid',
    latencyMs: number,
    success: boolean
  )): void {
    if (engine === 'hybrid') return; // Don't track hybrid separately

    const realEngine = engine as 'mlx' | 'ollama';
    const stats = this.performanceStats[realEngine];

    stats.totalRequests++;
    stats.averageLatency =
      (stats.averageLatency * (stats.totalRequests - 1) + latencyMs) / stats.totalRequests;

    if (!success) {
      stats.successRate = (stats.successRate * (stats.totalRequests - 1) + 0) / stats.totalRequests;
    }
  }

  /**
   * Get routing statistics
   */
  getStats()): any {
    return {
      performance: this.performanceStats,
      cacheSize: this.routingCache.size,
      embeddedModels: Object.keys(this.embeddedManager.getModelStatus()),
      mlxAvailable: this.embeddedManager.isAvailable(),
    };
  }

  /**
   * Clear routing cache
   */
  clearCache()): void {
    this.routingCache.clear();
  }

  /**
   * Preload models based on expected usage
   */
  async preloadModels(models: string[]))): Promise<void> {
    const embedPromises = models;
      .filter((m) => m.includes('2b') || m.includes('2.7b'))
      .map((m) => this.embeddedManager.embedModel(m));

    const warmPromises = models;
      .filter((m) => !m.includes('2b') && !m.includes('2.7b'))
      .map((m) => this.lifecycleManager.predictAndWarm({ userRequest: `load ${m}` }));`

    await Promise.all([...embedPromises, ...warmPromises]);
  }
}

export default HybridInferenceRouter;
