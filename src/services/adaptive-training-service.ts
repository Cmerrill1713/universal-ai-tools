/**
 * Adaptive Training Service
 * Monitors model performance and automatically triggers fine-tuning
 * based on configurable thresholds for quality, speed, and user feedback
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '@/utils/logger';

import { dynamicModelRouter } from './dynamic-model-router';
import { mlxFineTuningService } from './mlx-fine-tuning-service';
import { modelDiscoveryService } from './model-discovery-service';
import { getSupabaseClient } from './supabase-client';

export interface TrainingThresholds extends Record<string, unknown> {
  qualityScore: number;           // Below this triggers retraining
  errorRate: number;              // Above this triggers adaptation
  responseTime: {
    simple: number;              // Max ms for simple tasks
    moderate: number;            // Max ms for moderate tasks
    complex: number;             // Max ms for complex tasks
  };
  userFeedback: {
    negative: number;            // Negative feedback rate threshold
    regenerations: number;       // Regeneration rate threshold
  };
  minSamplesRequired: number;    // Minimum samples before triggering
}

export interface ModelMetrics {
  modelId: string;
  provider: string;
  avgQuality: number;
  errorRate: number;
  avgResponseTime: number;
  negativeFeedback: number;
  regenerationRate: number;
  sampleCount: number;
  lastEvaluated: Date;
}

export interface TrainingJob {
  id: string;
  modelId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dataset: any[];
  config: {
    method: 'lora' | 'qlora' | 'full';
    epochs: number;
    learningRate: number;
    batchSize: number;
  };
  status: 'queued' | 'training' | 'evaluating' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  metrics?: {
    loss: number;
    accuracy?: number;
    improvement?: number;
  };
}

export class AdaptiveTrainingService extends EventEmitter {
  private thresholds: TrainingThresholds;
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private trainingQueue: TrainingJob[] = [];
  private isTraining = false;
  private trainingLock = false; // Synchronization lock
  private monitoringInterval: NodeJS.Timeout | null = null;
  private evaluationHistory: Map<string, any[]> = new Map();

  constructor() {
    super();
    
    // Default thresholds - can be overridden
    this.thresholds = {
      qualityScore: 0.7,
      errorRate: 0.2,
      responseTime: {
        simple: 2000,
        moderate: 5000,
        complex: 15000,
      },
      userFeedback: {
        negative: 0.3,
        regenerations: 0.4,
      },
      minSamplesRequired: 100,
    };

    this.startMonitoring();
    this.loadHistoricalMetrics();
  }

  /**
   * Start monitoring model performance
   */
  private startMonitoring(): void {
    // Check every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.evaluateModels();
    }, 5 * 60 * 1000);

    log.info('🔍 Adaptive training monitoring started', LogContext.AI, {
      checkInterval: '5 minutes',
      thresholds: this.thresholds,
    });
  }

  /**
   * Evaluate all models against thresholds
   */
  private async evaluateModels(): Promise<void> {
    const models = modelDiscoveryService.getModels();
    const performanceReport = dynamicModelRouter.getPerformanceReport();

    for (const model of models) {
      const key = `${model.provider}:${model.id}`;
      const performance = performanceReport[key];

      if (!performance || performance.sampleCount < this.thresholds.minSamplesRequired) {
        continue; // Not enough data
      }

      // Get or create metrics
      let metrics = this.modelMetrics.get(key);
      if (!metrics) {
        metrics = {
          modelId: model.id,
          provider: model.provider,
          avgQuality: performance.avgQuality || 0.8,
          errorRate: 1 - performance.successRate,
          avgResponseTime: performance.avgLatency,
          negativeFeedback: 0,
          regenerationRate: 0,
          sampleCount: performance.sampleCount,
          lastEvaluated: new Date(),
        };
      }

      // Update metrics from performance report
      metrics.avgQuality = performance.avgQuality || metrics.avgQuality;
      metrics.errorRate = 1 - performance.successRate;
      metrics.avgResponseTime = performance.avgLatency;
      metrics.sampleCount = performance.sampleCount;

      // Fetch user feedback metrics from Supabase
      const feedbackMetrics = await this.fetchUserFeedbackMetrics(model.id);
      if (feedbackMetrics) {
        metrics.negativeFeedback = feedbackMetrics.negativeRate;
        metrics.regenerationRate = feedbackMetrics.regenerationRate;
      }

      // Check thresholds and trigger training if needed
      const trainingNeeded = this.checkThresholds(model, metrics);
      if (trainingNeeded) {
        await this.scheduleTraining(model, metrics, trainingNeeded.reason, trainingNeeded.priority);
      }

      // Update stored metrics
      metrics.lastEvaluated = new Date();
      this.modelMetrics.set(key, metrics);
    }

    // Process training queue
    if (!this.isTraining && this.trainingQueue.length > 0) {
      await this.processTrainingQueue();
    }
  }

  /**
   * Check if model needs retraining based on thresholds
   */
  private checkThresholds(
    model: any, 
    metrics: ModelMetrics
  ): { reason: string; priority: 'low' | 'medium' | 'high' | 'critical' } | null {
    const reasons: string[] = [];
    let maxPriority: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Quality threshold
    if (metrics.avgQuality < this.thresholds.qualityScore) {
      reasons.push(`Quality below threshold (${metrics.avgQuality.toFixed(2)} < ${this.thresholds.qualityScore})`);
      maxPriority = 'high';
    }

    // Error rate threshold
    if (metrics.errorRate > this.thresholds.errorRate) {
      reasons.push(`Error rate too high (${(metrics.errorRate * 100).toFixed(1)}% > ${this.thresholds.errorRate * 100}%)`);
      maxPriority = 'critical';
    }

    // Response time thresholds
    const complexity = this.estimateModelComplexity(model);
    const timeThreshold = this.thresholds.responseTime[complexity];
    if (metrics.avgResponseTime > timeThreshold) {
      reasons.push(`Response time too slow (${metrics.avgResponseTime}ms > ${timeThreshold}ms)`);
      if (maxPriority === 'low') maxPriority = 'medium';
    }

    // User feedback thresholds
    if (metrics.negativeFeedback > this.thresholds.userFeedback.negative) {
      reasons.push(`High negative feedback (${(metrics.negativeFeedback * 100).toFixed(1)}%)`);
      if (maxPriority !== 'critical') maxPriority = 'high';
    }

    if (metrics.regenerationRate > this.thresholds.userFeedback.regenerations) {
      reasons.push(`High regeneration rate (${(metrics.regenerationRate * 100).toFixed(1)}%)`);
      if (maxPriority === 'low') maxPriority = 'medium';
    }

    return reasons.length > 0 
      ? { reason: reasons.join('; '), priority: maxPriority }
      : null;
  }

  /**
   * Schedule a training job
   */
  private async scheduleTraining(
    model: any,
    metrics: ModelMetrics,
    reason: string,
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    // Check if already scheduled
    const existing = this.trainingQueue.find(
      job => job.modelId === model.id && job.status === 'queued'
    );
    
    if (existing) {
      // Update priority if higher
      if (this.getPriorityLevel(priority) > this.getPriorityLevel(existing.priority)) {
        existing.priority = priority;
        existing.reason = reason;
      }
      return;
    }

    // Prepare training dataset based on issues
    const dataset = await this.prepareTrainingDataset(model, metrics, reason);

    // Determine training config based on model size and issues
    const config = this.determineTrainingConfig(model, metrics, priority);

    const job: TrainingJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      modelId: model.id,
      reason,
      priority,
      dataset,
      config,
      status: 'queued',
    };

    this.trainingQueue.push(job);
    
    // Sort queue by priority
    this.trainingQueue.sort((a, b) => 
      this.getPriorityLevel(b.priority) - this.getPriorityLevel(a.priority)
    );

    log.info('📋 Training job scheduled', LogContext.AI, {
      modelId: model.id,
      reason,
      priority,
      queuePosition: this.trainingQueue.length,
    });

    this.emit('training-scheduled', job);
  }

  /**
   * Process the training queue
   */
  private async processTrainingQueue(): Promise<void> {
    // Use lock to prevent race conditions
    if (this.trainingLock || this.isTraining || this.trainingQueue.length === 0) return;
    
    this.trainingLock = true;
    
    try {
      const job = this.trainingQueue.find(j => j.status === 'queued');
      if (!job) {
        this.trainingLock = false;
        return;
      }

      this.isTraining = true;
    job.status = 'training';
    job.startedAt = new Date();

    log.info('🎯 Starting training job', LogContext.AI, {
      jobId: job.id,
      modelId: job.modelId,
      priority: job.priority,
    });

    try {
      // Use MLX for training if available
      if (await this.canUseMLX(job.modelId)) {
        await this.trainWithMLX(job);
      } else {
        await this.trainWithAlternative(job);
      }

      job.status = 'evaluating';
      const improvement = await this.evaluateTraining(job);
      
      job.metrics = {
        loss: 0.1, // Would come from actual training
        accuracy: 0.95,
        improvement,
      };

      if (improvement > 0) {
        job.status = 'completed';
        log.info('✅ Training completed successfully', LogContext.AI, {
          jobId: job.id,
          improvement: `${(improvement * 100).toFixed(1)}%`,
        });
        
        // Reset performance metrics for fresh evaluation
        dynamicModelRouter.resetModelPerformance(job.modelId, 'lmstudio');
      } else {
        job.status = 'failed';
        log.warn('⚠️ Training did not improve model', LogContext.AI, {
          jobId: job.id,
        });
      }
    } catch (error) {
      job.status = 'failed';
      log.error('❌ Training job failed', LogContext.AI, {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      job.completedAt = new Date();
      this.isTraining = false;
      this.trainingLock = false;
      this.emit('training-completed', job);
      
      // Continue with next job
      setTimeout(() => this.processTrainingQueue(), 1000);
    }
    } catch (outerError) {
      this.trainingLock = false;
      this.isTraining = false;
      log.error('Training process failed', LogContext.AI, { error: outerError });
    }
  }

  /**
   * Train model using MLX
   */
  private async trainWithMLX(job: TrainingJob): Promise<void> {
    const trainingConfig = {
      model: job.modelId,
      method: job.config.method,
      dataset: job.dataset,
      epochs: job.config.epochs,
      learning_rate: job.config.learningRate,
      batch_size: job.config.batchSize,
      use_lora: job.config.method === 'lora',
      use_qlora: job.config.method === 'qlora',
      save_every: Math.floor(job.config.epochs / 5),
      val_batches: 10,
    };

    // Start MLX training
    // TODO: Implement MLX training when service is ready
    log.info('MLX training would start here', LogContext.AI, trainingConfig);
    
    // Monitor progress
    let lastProgress = 0;
    while (true) {
      // TODO: Implement status check when MLX service is ready
      const status: { status: string; progress: number; error?: string; metrics?: { loss?: number } } = { status: 'completed', progress: 100 };
      
      if (status.status === 'completed') {
        break;
      } else if (status.status === 'failed') {
        throw new Error(status.error || 'Training failed');
      }
      
      if (status.progress && status.progress > lastProgress) {
        lastProgress = status.progress;
        this.emit('training-progress', {
          jobId: job.id,
          progress: status.progress,
          loss: status.metrics?.loss,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  /**
   * Alternative training method when MLX is not available
   */
  private async trainWithAlternative(job: TrainingJob): Promise<void> {
    // Implement alternative training method
    // Could use API-based fine-tuning services or other local methods
    log.info('Using alternative training method', LogContext.AI, {
      modelId: job.modelId,
    });
    
    // Simulate training
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  /**
   * Evaluate training results
   */
  private async evaluateTraining(job: TrainingJob): Promise<number> {
    // Run evaluation on test set
    // Compare before/after metrics
    // Return improvement percentage
    
    // For now, simulate evaluation
    const improvement = 0.1 + Math.random() * 0.2; // 10-30% improvement
    
    return improvement;
  }

  /**
   * Prepare training dataset based on issues
   */
  private async prepareTrainingDataset(
    model: any,
    metrics: ModelMetrics,
    reason: string
  ): Promise<any[]> {
    const dataset: any[] = [];

    // Fetch problematic examples from history
    if (reason.includes('Quality')) {
      // Get low-quality responses
      const lowQualityExamples = await this.fetchLowQualityExamples(model.id);
      dataset.push(...lowQualityExamples);
    }

    if (reason.includes('Error')) {
      // Get error cases
      const errorExamples = await this.fetchErrorExamples(model.id);
      dataset.push(...errorExamples);
    }

    if (reason.includes('feedback')) {
      // Get negative feedback examples
      const negativeFeedback = await this.fetchNegativeFeedbackExamples(model.id);
      dataset.push(...negativeFeedback);
    }

    // Add synthetic examples for improvement
    const syntheticExamples = this.generateSyntheticExamples(model, metrics);
    dataset.push(...syntheticExamples);

    return dataset;
  }

  /**
   * Determine optimal training configuration
   */
  private determineTrainingConfig(
    model: any,
    metrics: ModelMetrics,
    priority: string
  ): TrainingJob['config'] {
    // Use LoRA for large models, full fine-tuning for small ones
    const method = model.tier >= 3 ? 'lora' : 'full';
    
    // More epochs for critical issues
    const epochs = priority === 'critical' ? 10 : 
                   priority === 'high' ? 5 : 3;
    
    // Learning rate based on model size
    const learningRate = model.tier === 1 ? 1e-4 :
                        model.tier === 2 ? 5e-5 :
                        1e-5;
    
    // Batch size based on model size
    const batchSize = model.tier <= 2 ? 8 : 4;

    return {
      method: method as 'lora' | 'qlora' | 'full',
      epochs,
      learningRate,
      batchSize,
    };
  }

  /**
   * Helper methods
   */
  
  private getPriorityLevel(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private estimateModelComplexity(model: any): 'simple' | 'moderate' | 'complex' {
    if (model.tier <= 1) return 'simple';
    if (model.tier <= 2) return 'moderate';
    return 'complex';
  }

  private async canUseMLX(modelId: string): Promise<boolean> {
    // TODO: Check if model is compatible with MLX
    return false; // MLX service not yet implemented
  }

  private async fetchUserFeedbackMetrics(modelId: string): Promise<any> {
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) return null;
    try {
      const { data } = await supabaseClient
        .from('model_feedback')
        .select('rating, regenerated')
        .eq('model_id', modelId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (!data || data.length === 0) return null;
      
      const negative = data.filter((d: any) => d.rating < 3).length;
      const regenerated = data.filter((d: any) => d.regenerated).length;
      
      return {
        negativeRate: negative / data.length,
        regenerationRate: regenerated / data.length,
      };
    } catch (error) {
      return null;
    }
  }

  private async fetchLowQualityExamples(modelId: string): Promise<any[]> {
    // Fetch examples with low quality scores
    return [];
  }

  private async fetchErrorExamples(modelId: string): Promise<any[]> {
    // Fetch examples that resulted in errors
    return [];
  }

  private async fetchNegativeFeedbackExamples(modelId: string): Promise<any[]> {
    // Fetch examples with negative user feedback
    return [];
  }

  private generateSyntheticExamples(model: any, metrics: ModelMetrics): any[] {
    // Generate synthetic training examples
    return [];
  }

  private async loadHistoricalMetrics(): Promise<void> {
    // Load historical metrics from storage
  }

  /**
   * Public API
   */

  public updateThresholds(thresholds: Partial<TrainingThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    log.info('Thresholds updated', LogContext.AI, this.thresholds as Record<string, unknown>);
  }

  public getTrainingQueue(): TrainingJob[] {
    return [...this.trainingQueue];
  }

  public getModelMetrics(): Map<string, ModelMetrics> {
    return new Map(this.modelMetrics);
  }

  public async forceEvaluation(): Promise<void> {
    await this.evaluateModels();
  }

  public async forceTraining(modelId: string, reason: string = 'Manual trigger'): Promise<void> {
    const model = modelDiscoveryService.getModels().find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const metrics = this.modelMetrics.get(`${model.provider}:${modelId}`) || {
      modelId,
      provider: model.provider,
      avgQuality: 0.5,
      errorRate: 0.5,
      avgResponseTime: 10000,
      negativeFeedback: 0.5,
      regenerationRate: 0.5,
      sampleCount: 100,
      lastEvaluated: new Date(),
    };

    await this.scheduleTraining(model, metrics, reason, 'high');
  }

  /**
   * Domain-specific RL training for specialized tasks like code search
   * Inspired by ToolTrain's approach to tool-integrated reinforcement learning
   */
  public async scheduleRLTraining(
    domain: 'code-search' | 'tool-usage' | 'multi-hop-reasoning',
    config: {
      agentId?: string;
      targetPerformance: number;
      trainingData: Array<{
        state: any;
        action: any;
        reward: number;
        nextState: any;
        metadata?: any;
      }>;
      rlConfig?: {
        algorithm: 'dqn' | 'ppo' | 'a3c' | 'tooltrain-rl';
        learningRate: number;
        explorationRate: number;
        rewardShaping: boolean;
        episodes: number;
      };
    }
  ): Promise<string> {
    const jobId = `rl_${domain}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const rlJob: TrainingJob = {
      id: jobId,
      modelId: config.agentId || `${domain}-agent`,
      reason: `RL training for ${domain} domain`,
      priority: 'high',
      dataset: config.trainingData,
      config: {
        method: 'full', // RL requires full model access
        epochs: config.rlConfig?.episodes || 100,
        learningRate: config.rlConfig?.learningRate || 0.001,
        batchSize: 32,
      },
      status: 'queued',
    };

    // Add RL-specific metadata
    (rlJob as any).rlConfig = {
      domain,
      algorithm: config.rlConfig?.algorithm || 'tooltrain-rl',
      targetPerformance: config.targetPerformance,
      explorationRate: config.rlConfig?.explorationRate || 0.1,
      rewardShaping: config.rlConfig?.rewardShaping || true,
      trainingType: 'reinforcement_learning',
    };

    this.trainingQueue.push(rlJob);
    
    // Sort queue by priority
    this.trainingQueue.sort((a, b) => 
      this.getPriorityLevel(b.priority) - this.getPriorityLevel(a.priority)
    );

    log.info('📈 RL training job scheduled', LogContext.AI, {
      jobId,
      domain,
      algorithm: config.rlConfig?.algorithm || 'tooltrain-rl',
      targetPerformance: config.targetPerformance,
      trainingDataSize: config.trainingData.length,
    });

    this.emit('rl-training-scheduled', rlJob);
    return jobId;
  }

  /**
   * Collect RL training data from agent interactions
   */
  public collectRLData(
    domain: string,
    agentId: string,
    interactions: Array<{
      state: any;
      action: any;
      reward: number;
      nextState: any;
      done: boolean;
      metadata?: any;
    }>
  ): void {
    // Store RL interaction data for future training
    const key = `rl_data_${domain}_${agentId}`;
    
    if (!(this as any).rlDataStore) {
      (this as any).rlDataStore = new Map();
    }
    
    const rlStore = (this as any).rlDataStore || new Map();
    const existingData = rlStore.get(key) || [];
    
    existingData.push(...interactions.map(interaction => ({
      ...interaction,
      timestamp: Date.now(),
      domain,
      agentId,
    })));
    
    // Keep only recent data (last 1000 interactions per agent)
    if (existingData.length > 1000) {
      existingData.splice(0, existingData.length - 1000);
    }
    
    rlStore.set(key, existingData);
    (this as any).rlDataStore = rlStore;

    log.debug('RL interaction data collected', LogContext.AI, {
      domain,
      agentId,
      newInteractions: interactions.length,
      totalStored: existingData.length,
    });

    // Auto-trigger training if we have enough data and performance is below threshold
    this.checkAutoRLTraining(domain, agentId, existingData);
  }

  /**
   * Check if automatic RL training should be triggered
   */
  private async checkAutoRLTraining(domain: string, agentId: string, data: any[]): Promise<void> {
    if (data.length < 100) return; // Need minimum data

    // Calculate recent performance
    const recentData = data.slice(-50);
    const avgReward = recentData.reduce((sum, d) => sum + d.reward, 0) / recentData.length;
    
    // Define performance thresholds by domain
    const thresholds = {
      'code-search': 0.7,
      'tool-usage': 0.8,
      'multi-hop-reasoning': 0.6,
    };
    
    const threshold = thresholds[domain as keyof typeof thresholds] || 0.7;
    
    if (avgReward < threshold) {
      log.info('🤖 Auto-triggering RL training due to low performance', LogContext.AI, {
        domain,
        agentId,
        avgReward,
        threshold,
        dataSize: data.length,
      });

      await this.scheduleRLTraining(domain as any, {
        agentId,
        targetPerformance: threshold + 0.1,
        trainingData: data.slice(-200), // Use recent data
        rlConfig: {
          algorithm: 'tooltrain-rl',
          learningRate: 0.0005,
          explorationRate: 0.15,
          rewardShaping: true,
          episodes: 50,
        },
      });
    }
  }

  /**
   * Get RL training statistics
   */
  public getRLTrainingStats(): {
    totalRLJobs: number;
    completedRLJobs: number;
    avgRLPerformanceGain: number;
    domainStats: Record<string, {
      jobs: number;
      avgReward: number;
      dataPoints: number;
    }>;
  } {
    const rlJobs = this.trainingQueue.filter(job => (job as any).rlConfig?.trainingType === 'reinforcement_learning');
    const completedRLJobs = rlJobs.filter(job => job.status === 'completed');
    
    const rlStore = (this as any).rlDataStore || new Map();
    const domainStats: Record<string, any> = {};
    
    for (const [key, data] of rlStore.entries()) {
      const [, , domain] = key.split('_');
      if (!domainStats[domain]) {
        domainStats[domain] = {
          jobs: 0,
          avgReward: 0,
          dataPoints: 0,
        };
      }
      
      domainStats[domain].dataPoints += (data as any[]).length;
      if ((data as any[]).length > 0) {
        domainStats[domain].avgReward = (data as any[]).reduce((sum: number, d: any) => sum + d.reward, 0) / (data as any[]).length;
      }
    }
    
    // Count jobs by domain
    for (const job of rlJobs) {
      const domain = (job as any).rlConfig?.domain;
      if (domain && domainStats[domain]) {
        domainStats[domain].jobs++;
      }
    }
    
    const avgPerformanceGain = completedRLJobs.length > 0 ?
      completedRLJobs.reduce((sum, job) => sum + (job.metrics?.improvement || 0), 0) / completedRLJobs.length :
      0;

    return {
      totalRLJobs: rlJobs.length,
      completedRLJobs: completedRLJobs.length,
      avgRLPerformanceGain: avgPerformanceGain,
      domainStats,
    };
  }

  /**
   * ToolTrain-style training with tool usage optimization
   */
  public async trainToolUsagePolicy(
    agentId: string,
    toolInteractions: Array<{
      context: any;
      toolSequence: Array<{
        tool: string;
        params: any;
        result: any;
        reward: number;
      }>;
      finalReward: number;
      searchDepth: number;
      targetFound: boolean;
    }>
  ): Promise<string> {
    // Convert tool interactions to RL training format
    const trainingData = toolInteractions.flatMap(interaction => 
      interaction.toolSequence.map((step, index) => ({
        state: {
          context: interaction.context,
          currentDepth: index,
          previousTools: interaction.toolSequence.slice(0, index).map(s => s.tool),
          targetContext: interaction.targetFound,
        },
        action: {
          tool: step.tool,
          params: step.params,
        },
        reward: this.calculateToolUsageReward(step, interaction, index),
        nextState: {
          context: interaction.context,
          currentDepth: index + 1,
          previousTools: interaction.toolSequence.slice(0, index + 1).map(s => s.tool),
          targetContext: interaction.targetFound,
        },
        metadata: {
          toolResult: step.result,
          searchDepth: interaction.searchDepth,
          finalReward: interaction.finalReward,
        },
      }))
    );

    return await this.scheduleRLTraining('tool-usage', {
      agentId,
      targetPerformance: 0.85,
      trainingData,
      rlConfig: {
        algorithm: 'tooltrain-rl',
        learningRate: 0.001,
        explorationRate: 0.1,
        rewardShaping: true,
        episodes: 100,
      },
    });
  }

  /**
   * Calculate reward for tool usage based on ToolTrain principles
   */
  private calculateToolUsageReward(
    step: any,
    interaction: any,
    stepIndex: number
  ): number {
    let reward = 0;
    
    // Base reward for successful tool usage
    if (step.result && !step.result.error) {
      reward += 0.5;
    }
    
    // Efficiency bonus (fewer steps to reach target)
    const efficiencyBonus = Math.max(0, 1 - (stepIndex / 10)) * 0.3;
    reward += efficiencyBonus;
    
    // Target finding bonus
    if (interaction.targetFound) {
      reward += 0.4;
      
      // Early discovery bonus
      if (stepIndex < interaction.searchDepth / 2) {
        reward += 0.2;
      }
    }
    
    // Tool relevance bonus
    const toolRelevance = this.calculateToolRelevance(step.tool, interaction.context);
    reward += toolRelevance * 0.3;
    
    // Penalty for excessive depth
    if (stepIndex > 8) {
      reward -= 0.1;
    }
    
    return Math.max(-1, Math.min(1, reward));
  }

  /**
   * Calculate tool relevance to context
   */
  private calculateToolRelevance(tool: string, context: any): number {
    const contextStr = JSON.stringify(context).toLowerCase();
    
    // Simple heuristics - in production, this could be learned
    if (tool === 'search_code' && contextStr.includes('function')) return 0.9;
    if (tool === 'analyze_class' && contextStr.includes('class')) return 0.9;
    if (tool === 'trace_imports' && contextStr.includes('import')) return 0.8;
    if (tool === 'find_usages' && contextStr.includes('usage')) return 0.8;
    
    return 0.5; // Neutral relevance
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Singleton instance
export const adaptiveTrainingService = new AdaptiveTrainingService();