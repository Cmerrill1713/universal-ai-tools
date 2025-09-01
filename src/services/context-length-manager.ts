/**
 * Context Length Manager - Dynamic Context Management
 * 
 * Manages context length for different LLM models and providers,
 * automatically adjusts based on model capabilities and task requirements.
 */

import { log, LogContext } from '../utils/logger';

export interface ModelContextInfo {
  modelId: string;
  provider: 'lm-studio' | 'ollama' | 'openai' | 'anthropic' | 'mlx';
  maxContextLength: number;
  recommendedContextLength: number;
  supportsLongContext: boolean;
  contextWindow: {
    input: number;
    output: number;
    total: number;
  };
  description?: string;
  optimizedFor?: string[];
}

export interface ContextLengthRequest {
  modelId: string;
  provider: string;
  taskType: string;
  inputLength: number;
  preferredOutputLength?: number;
  priority: 'speed' | 'quality' | 'balanced';
}

export interface ContextLengthResponse {
  maxTokens: number;
  contextLength: number;
  truncationStrategy: 'none' | 'start' | 'middle' | 'end' | 'smart';
  reasoning: string;
  efficiency: number; // 0-1, how well we're using available context
}

export class ContextLengthManager {
  private modelContextMap: Map<string, ModelContextInfo> = new Map();
  private initialized = false;

  constructor() {
    this.initializeModelContextInfo();
  }

  /**
   * Initialize context information for all known models
   */
  private initializeModelContextInfo(): void {
    const models: ModelContextInfo[] = [
      // LM Studio Models (Current Available Models)
      {
        modelId: 'qwen/qwen3-30b-a3b-2507',
        provider: 'lm-studio',
        maxContextLength: 128000,
        recommendedContextLength: 100000,
        supportsLongContext: true,
        contextWindow: { input: 120000, output: 8000, total: 128000 },
        description: 'Qwen 30B - Large context, advanced reasoning',
        optimizedFor: ['complex-reasoning', 'long-documents', 'analysis']
      },
      {
        modelId: 'qwen/qwen3-coder-30b',
        provider: 'lm-studio',
        maxContextLength: 128000,
        recommendedContextLength: 100000,
        supportsLongContext: true,
        contextWindow: { input: 120000, output: 8000, total: 128000 },
        description: 'Qwen 30B Coder - Advanced coding with large context',
        optimizedFor: ['typescript', 'python', 'code-review', 'refactoring']
      },
      {
        modelId: 'qwen2.5-coder-14b-instruct-mlx',
        provider: 'lm-studio',
        maxContextLength: 32768,
        recommendedContextLength: 28000,
        supportsLongContext: true,
        contextWindow: { input: 28000, output: 4768, total: 32768 },
        description: 'Qwen 14B Coder - MLX optimized for Apple Silicon',
        optimizedFor: ['typescript', 'javascript', 'fast-coding']
      },
      {
        modelId: 'openai/gpt-oss-20b',
        provider: 'lm-studio',
        maxContextLength: 32768,
        recommendedContextLength: 28000,
        supportsLongContext: true,
        contextWindow: { input: 28000, output: 4768, total: 32768 },
        description: 'GPT-style 20B model for general tasks',
        optimizedFor: ['general-purpose', 'conversation', 'writing']
      },
      {
        modelId: 'dolphin-mistral-24b-venice-edition-mlx',
        provider: 'lm-studio',
        maxContextLength: 32768,
        recommendedContextLength: 28000,
        supportsLongContext: true,
        contextWindow: { input: 28000, output: 4768, total: 32768 },
        description: 'Dolphin Mistral 24B - Creative and conversational',
        optimizedFor: ['creative-tasks', 'conversation', 'brainstorming']
      },
      {
        modelId: 'google/gemma-3-12b',
        provider: 'lm-studio',
        maxContextLength: 8192,
        recommendedContextLength: 7000,
        supportsLongContext: false,
        contextWindow: { input: 6000, output: 2192, total: 8192 },
        description: 'Google Gemma 12B - Structured reasoning',
        optimizedFor: ['logical-reasoning', 'analysis', 'structured-thinking']
      },
      {
        modelId: 'google/gemma-3-4b',
        provider: 'lm-studio',
        maxContextLength: 8192,
        recommendedContextLength: 7000,
        supportsLongContext: false,
        contextWindow: { input: 6000, output: 2192, total: 8192 },
        description: 'Google Gemma 4B - Fast responses',
        optimizedFor: ['quick-responses', 'simple-tasks']
      },
      {
        modelId: 'deepseek/deepseek-r1-0528-qwen3-8b',
        provider: 'lm-studio',
        maxContextLength: 32768,
        recommendedContextLength: 28000,
        supportsLongContext: true,
        contextWindow: { input: 28000, output: 4768, total: 32768 },
        description: 'DeepSeek R1 8B - Advanced reasoning and math',
        optimizedFor: ['mathematical-reasoning', 'logical-analysis']
      },
      {
        modelId: 'mistralai/mistral-small-3.2',
        provider: 'lm-studio',
        maxContextLength: 32768,
        recommendedContextLength: 28000,
        supportsLongContext: true,
        contextWindow: { input: 28000, output: 4768, total: 32768 },
        description: 'Mistral Small 3.2 - Balanced performance',
        optimizedFor: ['balanced-performance', 'general-tasks']
      },
      {
        modelId: 'mistralai/devstral-small-2505',
        provider: 'lm-studio',
        maxContextLength: 32768,
        recommendedContextLength: 28000,
        supportsLongContext: true,
        contextWindow: { input: 28000, output: 4768, total: 32768 },
        description: 'Mistral Devstral - Development focused',
        optimizedFor: ['development', 'technical-documentation']
      },
      {
        modelId: 'llama-3.2-1b-instruct',
        provider: 'lm-studio',
        maxContextLength: 8192,
        recommendedContextLength: 7000,
        supportsLongContext: false,
        contextWindow: { input: 6000, output: 2192, total: 8192 },
        description: 'Llama 3.2 1B - Ultra-fast responses',
        optimizedFor: ['ultra-fast-responses', 'simple-qa']
      },
      {
        modelId: 'qwen2.5-0.5b-instruct-mlx',
        provider: 'lm-studio',
        maxContextLength: 4096,
        recommendedContextLength: 3500,
        supportsLongContext: false,
        contextWindow: { input: 3000, output: 1096, total: 4096 },
        description: 'Qwen 0.5B - Ultra-fast routing and classification',
        optimizedFor: ['routing-decisions', 'classification']
      },
      {
        modelId: 'qwen2.5-coder-0.5b-instruct-mlx',
        provider: 'lm-studio',
        maxContextLength: 4096,
        recommendedContextLength: 3500,
        supportsLongContext: false,
        contextWindow: { input: 3000, output: 1096, total: 4096 },
        description: 'Qwen 0.5B Coder - Fast code assistance',
        optimizedFor: ['code-completion', 'syntax-validation']
      },
      {
        modelId: 'deepseek-r1-0528-coder-draft-0.6b-v1.0',
        provider: 'lm-studio',
        maxContextLength: 8192,
        recommendedContextLength: 7000,
        supportsLongContext: false,
        contextWindow: { input: 6000, output: 2192, total: 8192 },
        description: 'DeepSeek R1 Coder Draft - Quick coding assistance',
        optimizedFor: ['code-drafting', 'quick-fixes']
      },
      {
        modelId: 'text-embedding-nomic-embed-text-v1.5',
        provider: 'lm-studio',
        maxContextLength: 8192,
        recommendedContextLength: 8192,
        supportsLongContext: false,
        contextWindow: { input: 8192, output: 0, total: 8192 },
        description: 'Nomic Embed - High-quality text embeddings',
        optimizedFor: ['general-embedding', 'semantic-search']
      },

      // Ollama Models (Common ones)
      {
        modelId: 'qwen2.5:7b',
        provider: 'ollama',
        maxContextLength: 32768,
        recommendedContextLength: 28000,
        supportsLongContext: true,
        contextWindow: { input: 28000, output: 4768, total: 32768 },
        optimizedFor: ['general-tasks', 'reasoning']
      },
      {
        modelId: 'llama3.2:8b',
        provider: 'ollama',
        maxContextLength: 131072,
        recommendedContextLength: 120000,
        supportsLongContext: true,
        contextWindow: { input: 120000, output: 11072, total: 131072 },
        optimizedFor: ['long-context', 'analysis']
      },
      {
        modelId: 'codellama:7b',
        provider: 'ollama',
        maxContextLength: 16384,
        recommendedContextLength: 14000,
        supportsLongContext: false,
        contextWindow: { input: 12000, output: 4384, total: 16384 },
        optimizedFor: ['code-generation', 'programming']
      }
    ];

    // Populate the map
    models.forEach(model => {
      const key = `${model.provider}:${model.modelId}`;
      this.modelContextMap.set(key, model);
      // Also store without provider for fallback
      this.modelContextMap.set(model.modelId, model);
    });

    this.initialized = true;
    log.info('✅ Context Length Manager initialized', LogContext.AI, {
      totalModels: models.length,
      providers: Array.from(new Set(models.map(m => m.provider)))
    });
  }

  /**
   * Get optimal context length for a model and task
   */
  public getOptimalContextLength(request: ContextLengthRequest): ContextLengthResponse {
    const modelKey = `${request.provider}:${request.modelId}`;
    let modelInfo = this.modelContextMap.get(modelKey) || this.modelContextMap.get(request.modelId);

    // If model not found, use conservative defaults
    if (!modelInfo) {
      log.warn('⚠️ Model not found in context map, using defaults', LogContext.AI, {
        modelId: request.modelId,
        provider: request.provider
      });
      
      return {
        maxTokens: 4000,
        contextLength: 4096,
        truncationStrategy: 'smart',
        reasoning: 'Unknown model - using conservative defaults',
        efficiency: 0.5
      };
    }

    // Calculate optimal settings based on task and priority
    const availableContext = modelInfo.recommendedContextLength;
    const reservedForOutput = request.preferredOutputLength || this.getDefaultOutputLength(request.taskType);
    const availableForInput = availableContext - reservedForOutput;

    let maxTokens: number;
    let truncationStrategy: ContextLengthResponse['truncationStrategy'] = 'none';
    let efficiency: number;

    if (request.inputLength <= availableForInput) {
      // Input fits comfortably
      maxTokens = reservedForOutput;
      efficiency = request.inputLength / availableForInput;
    } else {
      // Need to truncate input
      maxTokens = Math.max(reservedForOutput, Math.floor(availableContext * 0.3));
      truncationStrategy = this.chooseTruncationStrategy(request.taskType);
      efficiency = availableForInput / request.inputLength;
    }

    // Adjust based on priority
    if (request.priority === 'speed') {
      maxTokens = Math.min(maxTokens, 2000);
    } else if (request.priority === 'quality' && modelInfo.supportsLongContext) {
      maxTokens = Math.min(maxTokens, modelInfo.contextWindow.output);
    }

    const reasoning = this.generateReasoning(modelInfo, request, maxTokens, truncationStrategy);

    return {
      maxTokens,
      contextLength: modelInfo.recommendedContextLength,
      truncationStrategy,
      reasoning,
      efficiency: Math.min(efficiency, 1.0)
    };
  }

  /**
   * Get model context information
   */
  public getModelInfo(modelId: string, provider?: string): ModelContextInfo | null {
    const key = provider ? `${provider}:${modelId}` : modelId;
    return this.modelContextMap.get(key) || null;
  }

  /**
   * Get all models that support long context (>16k tokens)
   */
  public getLongContextModels(): ModelContextInfo[] {
    return Array.from(this.modelContextMap.values())
      .filter(model => model.supportsLongContext)
      .sort((a, b) => b.maxContextLength - a.maxContextLength);
  }

  /**
   * Get recommended model for a specific context length requirement
   */
  public getRecommendedModelForContext(requiredContext: number, provider?: string): ModelContextInfo[] {
    let models = Array.from(this.modelContextMap.values())
      .filter(model => model.maxContextLength >= requiredContext);

    if (provider) {
      models = models.filter(model => model.provider === provider);
    }

    return models.sort((a, b) => {
      // Sort by context length (ascending) and then by efficiency
      const contextDiff = a.maxContextLength - b.maxContextLength;
      if (contextDiff !== 0) return contextDiff;
      
      // Prefer models optimized for the task
      return 0;
    });
  }

  private getDefaultOutputLength(taskType: string): number {
    const defaults = {
      'code-generation': 2000,
      'complex-analysis': 1500,
      'reasoning': 1200,
      'conversation': 800,
      'quick-response': 500,
      'embedding': 0,
      'classification': 100
    };

    return defaults[taskType as keyof typeof defaults] || 1000;
  }

  private chooseTruncationStrategy(taskType: string): ContextLengthResponse['truncationStrategy'] {
    const strategies = {
      'code-generation': 'smart',
      'complex-analysis': 'middle',
      'conversation': 'start',
      'quick-response': 'end',
      'reasoning': 'smart'
    };

    return strategies[taskType as keyof typeof strategies] || 'smart';
  }

  private generateReasoning(
    modelInfo: ModelContextInfo,
    request: ContextLengthRequest,
    maxTokens: number,
    truncationStrategy: string
  ): string {
    const parts = [
      `Using ${modelInfo.modelId} (max context: ${modelInfo.maxContextLength})`,
      `Task: ${request.taskType} with ${request.priority} priority`,
      `Output limit: ${maxTokens} tokens`,
      `Truncation: ${truncationStrategy}`
    ];

    if (modelInfo.optimizedFor?.includes(request.taskType)) {
      parts.push('Model optimized for this task type');
    }

    return parts.join('. ');
  }
}

// Singleton instance
export const contextLengthManager = new ContextLengthManager();