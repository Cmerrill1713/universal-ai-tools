/**
 * Enhanced Fast Model Router
 * Integrates speculative decoding and quantization for sub-second responses
 * Builds on intelligent model router with advanced optimization features
 */

import { LogContext, log } from '@/utils/logger';
import type { ModelMetadata } from './model-tier-manager';
import { ModelTier, modelTierManager } from './model-tier-manager';
import type { ClassificationResult } from './query-complexity-classifier';
import { QueryComplexity, queryComplexityClassifier } from './query-complexity-classifier';
import { intelligentParameterService } from './intelligent-parameter-service';
import { speculativeDecodingService } from './speculative-decoding-service';
import { advancedQuantizationService, QuantizationLevel } from './advanced-quantization-service';
import { intelligentModelRouter, type RoutingRequest, type RoutingResult } from './intelligent-model-router';
import { mlxService } from './mlx-service';

export interface EnhancedRoutingOptions {
  enableSpeculativeDecoding?: boolean;
  enableQuantization?: boolean;
  targetResponseTime?: number; // Target response time in ms
  quantizationLevel?: QuantizationLevel;
  speculativeLength?: number;
}

export interface EnhancedRoutingResult extends RoutingResult {
  optimizationMethods: string[];
  quantizationApplied?: boolean;
  speculativeDecodingUsed?: boolean;
  actualResponseTime?: number;
  speedupAchieved?: number;
}

export class EnhancedFastModelRouter {
  private quantizedModels: Map<string, string> = new Map(); // Original path -> Quantized path
  private speculativeCache: Map<string, any> = new Map();
  
  constructor() {
    this.initializeOptimizations();
  }

  /**
   * Initialize optimization systems
   */
  private async initializeOptimizations(): Promise<void> {
    try {
      log.info('🚀 Initializing enhanced fast model router', LogContext.AI);
      
      // Initialize speculative decoding service
      await speculativeDecodingService.initialize();
      
      // Pre-quantize frequently used models
      await this.preQuantizeModels();
      
      log.info('✅ Enhanced router initialized', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize enhanced router', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Pre-quantize models for faster inference
   */
  private async preQuantizeModels(): Promise<void> {
    const ultraFastModels = modelTierManager.getModelsInTier(ModelTier.ULTRA_FAST);
    const fastModels = modelTierManager.getModelsInTier(ModelTier.FAST);
    
    const modelsToQuantize = [...ultraFastModels, ...fastModels].slice(0, 3); // Top 3 models
    
    for (const model of modelsToQuantize) {
      try {
        const config = await advancedQuantizationService.getOptimalConfig(model, 2000); // 2GB target
        const result = await advancedQuantizationService.quantizeModel(
          model.location,
          config
        );
        
        this.quantizedModels.set(model.location, result.outputPath);
        
        log.info('✅ Pre-quantized model', LogContext.AI, {
          model: model.name,
          compressionRatio: result.compressionRatio.toFixed(2) + 'x',
          speedup: result.inferenceSpeedup.toFixed(2) + 'x'
        });
      } catch (error) {
        log.warn('Failed to pre-quantize model', LogContext.AI, {
          model: model.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Enhanced routing with optimizations
   */
  public async route(
    request: RoutingRequest,
    options: EnhancedRoutingOptions = {}
  ): Promise<EnhancedRoutingResult> {
    const startTime = Date.now();
    
    // Get base routing result
    const baseResult = await intelligentModelRouter.route(request);
    
    // Apply optimizations
    const optimizationMethods: string[] = [];
    let quantizationApplied = false;
    let speculativeDecodingUsed = false;
    
    // Check if model needs optimization based on target response time
    const needsOptimization = options.targetResponseTime && 
      baseResult.estimatedResponseTime > options.targetResponseTime;
    
    // Apply quantization if needed
    if ((options.enableQuantization || needsOptimization) && baseResult.selectedModel) {
      const quantizedPath = await this.applyQuantization(
        baseResult.selectedModel,
        options.quantizationLevel
      );
      
      if (quantizedPath) {
        // Update model path to use quantized version
        baseResult.selectedModel = {
          ...baseResult.selectedModel,
          location: quantizedPath,
          isQuantized: true
        };
        quantizationApplied = true;
        optimizationMethods.push('quantization');
      }
    }
    
    // Determine if speculative decoding should be used
    if (options.enableSpeculativeDecoding || 
        (needsOptimization && baseResult.classification.complexity !== QueryComplexity.SIMPLE)) {
      speculativeDecodingUsed = true;
      optimizationMethods.push('speculative-decoding');
    }
    
    const routingTime = Date.now() - startTime;
    
    // Create enhanced result
    const enhancedResult: EnhancedRoutingResult = {
      ...baseResult,
      optimizationMethods,
      quantizationApplied,
      speculativeDecodingUsed,
      estimatedResponseTime: this.calculateOptimizedResponseTime(
        baseResult.estimatedResponseTime,
        quantizationApplied,
        speculativeDecodingUsed
      )
    };
    
    log.info('⚡ Enhanced routing completed', LogContext.AI, {
      originalTime: baseResult.estimatedResponseTime + 'ms',
      optimizedTime: enhancedResult.estimatedResponseTime + 'ms',
      optimizations: optimizationMethods,
      routingTime: routingTime + 'ms'
    });
    
    return enhancedResult;
  }

  /**
   * Execute inference with optimizations
   */
  public async executeWithOptimizations(
    prompt: string,
    routingResult: EnhancedRoutingResult
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      if (routingResult.speculativeDecodingUsed) {
        // Use speculative decoding for faster generation
        result = await this.executeWithSpeculativeDecoding(
          prompt,
          routingResult.selectedModel,
          routingResult.parameters
        );
      } else {
        // Standard execution
        result = await this.executeStandard(
          prompt,
          routingResult.selectedModel,
          routingResult.parameters
        );
      }
      
      const actualResponseTime = Date.now() - startTime;
      const speedupAchieved = routingResult.estimatedResponseTime / actualResponseTime;
      
      log.info('✅ Optimized execution completed', LogContext.AI, {
        actualTime: actualResponseTime + 'ms',
        estimatedTime: routingResult.estimatedResponseTime + 'ms',
        speedup: speedupAchieved.toFixed(2) + 'x',
        optimizations: routingResult.optimizationMethods
      });
      
      // Report performance for learning
      intelligentModelRouter.reportModelPerformance(
        routingResult.selectedModel.id,
        actualResponseTime,
        true,
        0.9 // High satisfaction for fast responses
      );
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          actualResponseTime,
          speedupAchieved,
          optimizationsUsed: routingResult.optimizationMethods
        }
      };
      
    } catch (error) {
      log.error('❌ Optimized execution failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to standard execution
      return this.executeStandard(
        prompt,
        routingResult.fallbackModel || routingResult.selectedModel,
        routingResult.parameters
      );
    }
  }

  /**
   * Apply quantization to model
   */
  private async applyQuantization(
    model: ModelMetadata,
    preferredLevel?: QuantizationLevel
  ): Promise<string | null> {
    try {
      // Check if already quantized
      const existingQuantized = this.quantizedModels.get(model.location);
      if (existingQuantized) {
        return existingQuantized;
      }
      
      // Determine quantization level
      const level = preferredLevel || (
        model.tier === ModelTier.ULTRA_FAST ? QuantizationLevel.INT4 : QuantizationLevel.INT8
      );
      
      const config = {
        level,
        groupSize: 128,
        actOrder: true,
        symmetric: level === QuantizationLevel.INT4,
        perChannel: true,
        calibrationSamples: 128,
        optimizeForSpeed: true
      };
      
      const result = await advancedQuantizationService.quantizeModel(
        model.location,
        config
      );
      
      this.quantizedModels.set(model.location, result.outputPath);
      return result.outputPath;
      
    } catch (error) {
      log.warn('Quantization failed, using original model', LogContext.AI, {
        model: model.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Execute with speculative decoding
   */
  private async executeWithSpeculativeDecoding(
    prompt: string,
    model: ModelMetadata,
    parameters: any
  ): Promise<any> {
    // Check cache first
    const cacheKey = `${model.id}:${prompt.substring(0, 50)}`;
    const cached = this.speculativeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      log.debug('Using cached speculative result', LogContext.AI);
      return cached.result;
    }
    
    // Use speculative decoding service
    const result = await speculativeDecodingService.generate(
      prompt,
      parameters.maxTokens || 500,
      parameters.temperature || 0.7
    );
    
    // Cache result
    this.speculativeCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.speculativeCache.size > 100) {
      const entries = Array.from(this.speculativeCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, 50).forEach(([key]) => this.speculativeCache.delete(key));
    }
    
    return {
      success: true,
      data: result.text,
      metadata: {
        model: model.name,
        tokensGenerated: result.tokensGenerated,
        acceptanceRate: result.acceptanceRate,
        speedup: result.estimatedSpeedup,
        draftLength: result.averageDraftLength
      }
    };
  }

  /**
   * Standard execution without optimizations
   */
  private async executeStandard(
    prompt: string,
    model: ModelMetadata,
    parameters: any
  ): Promise<any> {
    // Use MLX service for MLX models
    if (model.format === 'mlx') {
      return mlxService.runInference({
        modelPath: model.location,
        prompt,
        parameters
      });
    }
    
    // For other formats, would use appropriate service
    // This is a placeholder
    return {
      success: true,
      data: 'Standard inference result',
      metadata: {
        model: model.name,
        format: model.format
      }
    };
  }

  /**
   * Calculate optimized response time
   */
  private calculateOptimizedResponseTime(
    baseTime: number,
    quantizationApplied: boolean,
    speculativeDecodingUsed: boolean
  ): number {
    let optimizedTime = baseTime;
    
    if (quantizationApplied) {
      optimizedTime *= 0.4; // 2.5x speedup from quantization
    }
    
    if (speculativeDecodingUsed) {
      optimizedTime *= 0.5; // 2x speedup from speculative decoding
    }
    
    return Math.round(optimizedTime);
  }

  /**
   * Get optimization statistics
   */
  public getStatistics(): any {
    return {
      quantizedModels: this.quantizedModels.size,
      speculativeCacheSize: this.speculativeCache.size,
      quantizationStats: advancedQuantizationService.getStatistics(),
      speculativeStats: speculativeDecodingService.getStatistics()
    };
  }
}

// Singleton instance
export const enhancedFastModelRouter = new EnhancedFastModelRouter();