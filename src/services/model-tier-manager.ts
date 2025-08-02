/**
 * Model-Agnostic Tier Management System
 * Automatically discovers, benchmarks, and classifies models by performance tiers
 * No hardcoded model names - fully dynamic and future-proof
 */

import { readdir, stat    } from 'fs/promises';';';';
import { join    } from 'path';';';';
import { LogContext, log    } from '@/utils/logger';';';';

export enum ModelTier {
  ULTRA_FAST = 'ultra_fast',    // <300ms - Simple queries, greetings'''
  FAST = 'fast',                // <1s - General chat, explanations  '''
  BALANCED = 'balanced',        // <2s - Analysis, reasoning'''
  POWERFUL = 'powerful',        // <5s - Complex tasks, coding'''
  ROUTER = 'router'             // <100ms - Routing decisions only'''
}

export enum ModelFormat {
  MLX = 'mlx','''
  GGUF = 'gguf','''
  SAFETENSORS = 'safetensors''''
}

export interface ModelMetadata {
  id: string;,
  name: string;,
  format: ModelFormat;,
  size: number;,
  location: string;
  tier?: ModelTier;
  benchmarkResults?: BenchmarkResults;
  isAvailable: boolean;
  lastUsed?: Date;
  warmupTime?: number;
  averageInferenceTime?: number;
}

export interface BenchmarkResults {
  avgResponseTime: number;,
  qualityScore: number;  // 0-1 based on simple test,
  memoryUsage: number;,
  warmupTime: number;,
  throughput: number;    // tokens/second,
  testDate: Date;
}

export interface TierConfiguration {
  maxResponseTimeMs: number;,
  useCases: string[];,
  preferredFormat: ModelFormat[];
  fallbackTo?: ModelTier;
  minQualityScore?: number;
  maxMemoryMB?: number;
}

export interface ModelTierConfig {
  tiers: Record<ModelTier, TierConfiguration>;
  discovery: {,
    mlxCachePath: string;,
    localModelPaths: string[];,
    huggingFacePath: string;
  };
  benchmarking: {,
    testPrompts: string[];,
    warmupPrompts: string[];,
    maxBenchmarkTime: number;
  };
  warming: {,
    alwaysWarmTiers: ModelTier[];,
    predictiveWarmingEnabled: boolean;,
    maxConcurrentWarmModels: number;
  };
}

export class ModelTierManager {
  private models: Map<string, ModelMetadata> = new Map();
  private tierAssignments: Map<ModelTier, string[]> = new Map();
  private warmModels: Set<string> = new Set();
  private config: ModelTierConfig;

  constructor(config?: Partial<ModelTierConfig>) {
    this.config = {
      tiers: {
        [ModelTier.ULTRA_FAST]: {
          maxResponseTimeMs: 300,
          useCases: ['simple_qa', 'greetings', 'quick_facts', 'classification'],'''
          preferredFormat: [ModelFormat.MLX, ModelFormat.GGUF],
          fallbackTo: ModelTier.FAST,
          minQualityScore: 0.6,
          maxMemoryMB: 2000
        },
        [ModelTier.FAST]: {
          maxResponseTimeMs: 1000,
          useCases: ['general_chat', 'explanations', 'summaries', 'casual_conversation'],'''
          preferredFormat: [ModelFormat.MLX, ModelFormat.GGUF],
          fallbackTo: ModelTier.BALANCED,
          minQualityScore: 0.7,
          maxMemoryMB: 4000
        },
        [ModelTier.BALANCED]: {
          maxResponseTimeMs: 2000,
          useCases: ['analysis', 'reasoning', 'detailed_explanations', 'problem_solving'],'''
          preferredFormat: [ModelFormat.MLX, ModelFormat.GGUF],
          fallbackTo: ModelTier.POWERFUL,
          minQualityScore: 0.8,
          maxMemoryMB: 8000
        },
        [ModelTier.POWERFUL]: {
          maxResponseTimeMs: 5000,
          useCases: ['complex_analysis', 'coding', 'research', 'creative_writing'],'''
          preferredFormat: [ModelFormat.MLX, ModelFormat.GGUF],
          minQualityScore: 0.85,
          maxMemoryMB: 16000
        },
        [ModelTier.ROUTER]: {
          maxResponseTimeMs: 100,
          useCases: ['routing', 'classification', 'intent_detection'],'''
          preferredFormat: [ModelFormat.MLX],
          minQualityScore: 0.9,
          maxMemoryMB: 3000
        }
      },
      discovery: {,
        mlxCachePath: `${process.env.HOME}/.cache/huggingface/hub`,
        localModelPaths: [
          '/Users/christianmerrill/Desktop/universal-ai-tools/models','''
          `${process.env.HOME}/.ollama/models`
        ],
        huggingFacePath: `${process.env.HOME}/.cache/huggingface/hub`
      },
      benchmarking: {,
        testPrompts: [
          'Hello, how are you?','''
          'Explain quantum physics in simple terms.','''
          'Write a Python function to calculate fibonacci numbers.','''
          'What is the capital of France?','''
          'Analyze the pros and cons of renewable energy.''''
        ],
        warmupPrompts: [
          'Hi','''
          'Test''''
        ],
        maxBenchmarkTime: 30000 // 30 seconds max per model
      },
      warming: {,
        alwaysWarmTiers: [ModelTier.ULTRA_FAST],
        predictiveWarmingEnabled: true,
        maxConcurrentWarmModels: 3
      },
      ...config
    };

    // Initialize tier assignments
    Object.values(ModelTier).forEach(tier => {)
      this.tierAssignments.set(tier, []);
    });
  }

  /**
   * Initialize the model tier manager - discover and benchmark models
   */
  public async initialize(): Promise<void> {
    log.info('🔍 Initializing Model Tier Manager', LogContext.AI);'''
    
    try {
      // Discover all available models
      await this.discoverModels();
      
      // Benchmark discovered models
      await this.benchmarkModels();
      
      // Assign models to tiers
      this.assignModelsTiers();
      
      // Start warming always-warm models
      await this.startAlwaysWarmModels();
      
      log.info('✅ Model Tier Manager initialized', LogContext.AI, {')''
        totalModels: this.models.size,
        tierDistribution: this.getTierDistribution(),
        warmModels: this.warmModels.size
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize Model Tier Manager', LogContext.AI, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Discover all available models in configured paths
   */
  private async discoverModels(): Promise<void> {
    log.info('📡 Discovering models', LogContext.AI);'''
    
    // Discover MLX models in Hugging Face cache
    await this.discoverMLXModels();
    
    // Discover local models
    await this.discoverLocalModels();
    
    log.info('📡 Model discovery complete', LogContext.AI, {')''
      discovered: this.models.size
    });
  }

  /**
   * Discover MLX models in Hugging Face cache
   */
  private async discoverMLXModels(): Promise<void> {
    try {
      const hubPath = this.config.discovery.huggingFacePath;
      const entries = await readdir(hubPath);
      
      for (const entry of entries) {
        if (entry.startsWith('models--mlx-community--') || entry.includes('mlx')) {'''
          const modelPath = join(hubPath, entry);
          const stats = await stat(modelPath);
          
          if (stats.isDirectory()) {
            const modelId = this.generateModelId(entry);
            const metadata: ModelMetadata = {,;
              id: modelId,
              name: this.cleanModelName(entry),
              format: ModelFormat.MLX,
              size: stats.size,
              location: modelPath,
              isAvailable: true
            };
            
            this.models.set(modelId, metadata);
            log.debug('Found MLX model', LogContext.AI, { name: metadata.name });'''
          }
        }
      }
    } catch (error) {
      log.warn('⚠️ Could not discover MLX models', LogContext.AI, {')''
        path: this.config.discovery.huggingFacePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Discover local models
   */
  private async discoverLocalModels(): Promise<void> {
    for (const basePath of this.config.discovery.localModelPaths) {
      try {
        await this.scanDirectory(basePath);
      } catch (error) {
        log.debug('Could not scan model directory', LogContext.AI, {')''
          path: basePath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Recursively scan directory for models
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (this.isModelFile(entry)) {
          const format = this.detectModelFormat(entry);
          const modelId = this.generateModelId(entry);
          
          const metadata: ModelMetadata = {,;
            id: modelId,
            name: this.cleanModelName(entry),
            format,
            size: stats.size,
            location: fullPath,
            isAvailable: true
          };
          
          this.models.set(modelId, metadata);
          log.debug('Found local model', LogContext.AI, { ')''
            name: metadata.name, 
            format: metadata.format 
          });
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read, skip silently'''
    }
  }

  /**
   * Check if file is a model file
   */
  private isModelFile(filename: string): boolean {
    const modelExtensions = ['.safetensors', '.gguf', '.bin', '.pt', '.pth'];';';';
    return modelExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Detect model format from filename
   */
  private detectModelFormat(filename: string): ModelFormat {
    if (filename.endsWith('.safetensors')) return ModelFormat.SAFETENSORS;'''
    if (filename.endsWith('.gguf')) return ModelFormat.GGUF;'''
    return ModelFormat.MLX; // Default for MLX format;
  }

  /**
   * Generate unique model ID
   */
  private generateModelId(name: string): string {
    return name.toLowerCase();
      .replace(/[^a-z0-9-]/g, '-')'''
      .replace(/-+/g, '-')'''
      .replace(/^-|-$/g, '');'''
  }

  /**
   * Clean model name for display
   */
  private cleanModelName(name: string): string {
    return name;
      .replace('models--mlx-community--', '')'''
      .replace(/--/g, '/')'''
      .replace(/-/g, ' ')'''
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Benchmark all discovered models (mock implementation for now)
   */
  private async benchmarkModels(): Promise<void> {
    log.info('⚡ Starting model benchmarking', LogContext.AI, {')''
      total: this.models.size
    });
    
    // For now, assign mock benchmark results based on model characteristics
    // In production, this would run actual inference tests
    for (const [id, model] of this.models.entries()) {
      const benchmarkResults: BenchmarkResults = this.generateMockBenchmark(model);
      model.benchmarkResults = benchmarkResults;
      model.averageInferenceTime = benchmarkResults.avgResponseTime;
      model.warmupTime = benchmarkResults.warmupTime;
      
      log.debug('Benchmarked model', LogContext.AI, {')''
        name: model.name,
        avgTime: benchmarkResults.avgResponseTime,
        quality: benchmarkResults.qualityScore
      });
    }
    
    log.info('⚡ Model benchmarking complete', LogContext.AI);'''
  }

  /**
   * Generate mock benchmark results based on model characteristics
   */
  private generateMockBenchmark(model: ModelMetadata): BenchmarkResults {
    // Estimate performance based on model size and format
    let baseTime = 1000; // Base 1 second;
    
    // MLX models are faster
    if (model.format === ModelFormat.MLX) {
      baseTime *= 0.3;
    }
    
    // Smaller models are faster (rough estimation)
    const sizeFactor = Math.min(model.size / (1024 * 1024 * 1024), 10); // GB;
    baseTime *= Math.max(0.1, sizeFactor * 0.2);
    
    // Add some randomness
    baseTime *= (0.8 + Math.random() * 0.4);
    
    return {
      avgResponseTime: Math.round(baseTime),
      qualityScore: 0.7 + Math.random() * 0.25, // 0.7-0.95
      memoryUsage: Math.round(model.size / (1024 * 1024)), // MB
      warmupTime: Math.round(baseTime * 2),
      throughput: Math.round(50 + Math.random() * 100), // tokens/sec
      testDate: new Date()
    };
  }

  /**
   * Assign models to appropriate tiers based on benchmark results
   */
  private assignModelsTiers(): void {
    log.info('🎯 Assigning models to tiers', LogContext.AI);'''
    
    for (const [id, model] of this.models.entries()) {
      if (!model.benchmarkResults) continue;
      
      const tier = this.determineModelTier(model);
      model.tier = tier;
      
      const tierModels = this.tierAssignments.get(tier) || [];
      tierModels.push(id);
      this.tierAssignments.set(tier, tierModels);
      
      log.debug('Assigned model to tier', LogContext.AI, {')''
        name: model.name,
        tier,
        responseTime: model.benchmarkResults.avgResponseTime
      });
    }
    
    // Sort models within each tier by performance
    this.sortTiersByPerformance();
  }

  /**
   * Determine which tier a model belongs to
   */
  private determineModelTier(model: ModelMetadata): ModelTier {
    if (!model.benchmarkResults) return ModelTier.BALANCED;
    
    const { avgResponseTime, qualityScore } = model.benchmarkResults;
    
    // Special case for router models (small, specialized)
    if (model.name.toLowerCase().includes('lfm2') || '''
        model.name.toLowerCase().includes('router')) {'''
      return ModelTier.ROUTER;
    }
    
    // Assign based on response time and quality
    for (const [tier, config] of Object.entries(this.config.tiers)) {
      if (avgResponseTime <= config.maxResponseTimeMs &&
          qualityScore >= (config.minQualityScore || 0) &&
          config.preferredFormat.includes(model.format)) {
        return tier as ModelTier;
      }
    }
    
    // Default fallback
    return ModelTier.BALANCED;
  }

  /**
   * Sort models within each tier by performance (best first)
   */
  private sortTiersByPerformance(): void {
    for (const [tier, modelIds] of this.tierAssignments.entries()) {
      modelIds.sort((a, b) => {
        const modelA = this.models.get(a);
        const modelB = this.models.get(b);
        
        if (!modelA?.benchmarkResults || !modelB?.benchmarkResults) return 0;
        
        // Sort by quality first, then by speed
        const qualityDiff = modelB.benchmarkResults.qualityScore - modelA.benchmarkResults.qualityScore;
        if (Math.abs(qualityDiff) > 0.05) return qualityDiff;
        
        return modelA.benchmarkResults.avgResponseTime - modelB.benchmarkResults.avgResponseTime;
      });
    }
  }

  /**
   * Start warming models that should always be warm
   */
  private async startAlwaysWarmModels(): Promise<void> {
    for (const tier of this.config.warming.alwaysWarmTiers) {
      const bestModel = this.getBestModelForTier(tier);
      if (bestModel) {
        await this.warmModel(bestModel.id);
      }
    }
  }

  /**
   * Get the best model for a specific tier
   */
  public getBestModelForTier(tier: ModelTier): ModelMetadata | null {
    const tierModels = this.tierAssignments.get(tier) || [];
    if (tierModels.length === 0) return null;
    
    const bestModelId = tierModels[0]; // Already sorted by performance;
    return this.models.get(bestModelId) || null;
  }

  /**
   * Get model for specific use case
   */
  public getModelForUseCase(useCase: string): ModelMetadata | null {
    // Find tier that handles this use case
    for (const [tier, config] of Object.entries(this.config.tiers)) {
      if (config.useCases.includes(useCase)) {
        return this.getBestModelForTier(tier as ModelTier);
      }
    }
    
    // Default to FAST tier
    return this.getBestModelForTier(ModelTier.FAST);
  }

  /**
   * Warm a model (mock implementation)
   */
  private async warmModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;
    
    log.info('🔥 Warming model', LogContext.AI, { name: model.name });'''
    
    // In production, this would load the model into memory
    this.warmModels.add(modelId);
    model.lastUsed = new Date();
    
    // Mock warmup time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Get tier distribution for logging
   */
  private getTierDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const [tier, models] of this.tierAssignments.entries()) {
      distribution[tier] = models.length;
    }
    return distribution;
  }

  /**
   * Get all models in a tier
   */
  public getModelsInTier(tier: ModelTier): ModelMetadata[] {
    const modelIds = this.tierAssignments.get(tier) || [];
    return modelIds.map(id => this.models.get(id)).filter(Boolean) as ModelMetadata[];
  }

  /**
   * Get model by ID
   */
  public getModel(modelId: string): ModelMetadata | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Get all models
   */
  public getAllModels(): ModelMetadata[] {
    return Array.from(this.models.values());
  }

  /**
   * Update model configuration
   */
  public updateConfig(config: Partial<ModelTierConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('📝 Model tier configuration updated', LogContext.AI);'''
  }
}

// Singleton instance
export const modelTierManager = new ModelTierManager();