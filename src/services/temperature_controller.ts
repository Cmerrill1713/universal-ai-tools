/**
 * Task-Aware Temperature Controller
 * Dynamically adjusts temperature based on task type and performance metrics
 */

import { logger } from '../utils/logger';
import { SupabaseService } from './supabase_service';

interface TemperatureProfile {
  taskType: string;
  minTemp: number;
  maxTemp: number;
  defaultTemp: number;
  description: string;
}

interface TemperatureAdjustment {
  factor: string;
  adjustment: number;
  reason: string;
}

interface TaskMetrics {
  taskType: string;
  successCount: number;
  failureCount: number;
  avgQualityScore: number;
  optimalTemp: number;
  lastUpdated: Date;
}

interface GenerationParams {
  temperature: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export class TemperatureController {
  private supabase: SupabaseService;
  
  // Task-specific temperature profiles
  private temperatureProfiles: Map<string, TemperatureProfile> = new Map([
    ['creative_writing', {
      taskType: 'creative_writing',
      minTemp: 0.7,
      maxTemp: 1.0,
      defaultTemp: 0.85,
      description: 'High creativity for storytelling and creative content'
    }],
    ['code_generation', {
      taskType: 'code_generation',
      minTemp: 0.0,
      maxTemp: 0.3,
      defaultTemp: 0.1,
      description: 'Low temperature for precise code generation'
    }],
    ['factual_qa', {
      taskType: 'factual_qa',
      minTemp: 0.0,
      maxTemp: 0.2,
      defaultTemp: 0.1,
      description: 'Very low temperature for accurate factual responses'
    }],
    ['brainstorming', {
      taskType: 'brainstorming',
      minTemp: 0.6,
      maxTemp: 0.9,
      defaultTemp: 0.75,
      description: 'High temperature for diverse idea generation'
    }],
    ['analysis', {
      taskType: 'analysis',
      minTemp: 0.2,
      maxTemp: 0.4,
      defaultTemp: 0.3,
      description: 'Moderate temperature for balanced analysis'
    }],
    ['translation', {
      taskType: 'translation',
      minTemp: 0.0,
      maxTemp: 0.2,
      defaultTemp: 0.1,
      description: 'Low temperature for accurate translations'
    }],
    ['summarization', {
      taskType: 'summarization',
      minTemp: 0.1,
      maxTemp: 0.3,
      defaultTemp: 0.2,
      description: 'Low-moderate temperature for concise summaries'
    }],
    ['conversation', {
      taskType: 'conversation',
      minTemp: 0.4,
      maxTemp: 0.7,
      defaultTemp: 0.55,
      description: 'Moderate temperature for natural conversation'
    }],
    ['technical_documentation', {
      taskType: 'technical_documentation',
      minTemp: 0.1,
      maxTemp: 0.3,
      defaultTemp: 0.2,
      description: 'Low temperature for precise technical writing'
    }],
    ['general', {
      taskType: 'general',
      minTemp: 0.3,
      maxTemp: 0.7,
      defaultTemp: 0.5,
      description: 'Balanced temperature for general tasks'
    }]
  ]);

  // Task performance metrics
  private taskMetrics: Map<string, TaskMetrics> = new Map();
  
  // A/B testing configurations
  private abTestConfigs = {
    enabled: true,
    sampleRate: 0.1, // 10% of requests participate in A/B testing
    variationRange: 0.1 // Test within ±0.1 of optimal temperature
  };

  constructor() {
    this.supabase = SupabaseService.getInstance();
    
    this.loadTaskMetrics();
    logger.info('🌡️ Task-Aware Temperature Controller initialized');
  }

  /**
   * Get optimal generation parameters for a task
   */
  public async getOptimalParams(
    taskType: string,
    context?: {
      complexity?: 'low' | 'medium' | 'high';
      userPreference?: number;
      previousAttempts?: number;
      qualityRequirement?: 'speed' | 'balanced' | 'quality';
    }
  ): Promise<GenerationParams> {
    // Get base temperature profile
    const profile = this.getTemperatureProfile(taskType);
    let temperature = profile.defaultTemp;

    // Apply adjustments based on context
    const adjustments: TemperatureAdjustment[] = [];

    // Complexity adjustment
    if (context?.complexity) {
      const complexityAdjustment = this.getComplexityAdjustment(context.complexity, taskType);
      temperature += complexityAdjustment.adjustment;
      adjustments.push(complexityAdjustment);
    }

    // User preference override
    if (context?.userPreference !== undefined) {
      const userAdjustment = this.getUserPreferenceAdjustment(
        context.userPreference,
        profile
      );
      temperature = userAdjustment.adjustment;
      adjustments.push({
        factor: 'user_preference',
        adjustment: userAdjustment.adjustment - profile.defaultTemp,
        reason: 'User-specified temperature preference'
      });
    }

    // Previous attempts adjustment (increase temp for retries)
    if (context?.previousAttempts && context.previousAttempts > 0) {
      const retryAdjustment = this.getRetryAdjustment(context.previousAttempts);
      temperature += retryAdjustment.adjustment;
      adjustments.push(retryAdjustment);
    }

    // Quality vs speed trade-off
    if (context?.qualityRequirement) {
      const qualityAdjustment = this.getQualityAdjustment(
        context.qualityRequirement,
        taskType
      );
      temperature += qualityAdjustment.adjustment;
      adjustments.push(qualityAdjustment);
    }

    // Apply learned optimizations
    const learnedTemp = await this.getLearnedTemperature(taskType);
    if (learnedTemp !== null) {
      const diff = learnedTemp - temperature;
      if (Math.abs(diff) > 0.05) {
        temperature = temperature + (diff * 0.5); // Blend learned and calculated
        adjustments.push({
          factor: 'learned_optimization',
          adjustment: diff * 0.5,
          reason: `Applied learned optimization from ${this.taskMetrics.get(taskType)?.successCount || 0} successful generations`
        });
      }
    }

    // Ensure temperature is within bounds
    temperature = Math.max(profile.minTemp, Math.min(profile.maxTemp, temperature));

    // A/B testing variation
    if (this.shouldRunABTest()) {
      const variation = this.getABTestVariation(temperature, profile);
      adjustments.push({
        factor: 'ab_testing',
        adjustment: variation - temperature,
        reason: 'A/B test variation for optimization'
      });
      temperature = variation;
    }

    // Calculate complementary parameters
    const params = this.calculateComplementaryParams(temperature, taskType);

    logger.info(
      `🎯 Temperature optimized for ${taskType}: ${temperature.toFixed(3)} ` +
      `(${adjustments.length} adjustments applied)`
    );

    return params;
  }

  /**
   * Get temperature profile for task type
   */
  private getTemperatureProfile(taskType: string): TemperatureProfile {
    // Check for exact match
    if (this.temperatureProfiles.has(taskType)) {
      return this.temperatureProfiles.get(taskType)!;
    }

    // Check for partial match
    const lowerTaskType = taskType.toLowerCase();
    for (const [key, profile] of this.temperatureProfiles.entries()) {
      if (lowerTaskType.includes(key) || key.includes(lowerTaskType)) {
        return profile;
      }
    }

    // Default to general profile
    return this.temperatureProfiles.get('general')!;
  }

  /**
   * Get complexity-based adjustment
   */
  private getComplexityAdjustment(
    complexity: 'low' | 'medium' | 'high',
    taskType: string
  ): TemperatureAdjustment {
    const adjustments = {
      low: -0.05,
      medium: 0,
      high: 0.05
    };

    // Inverse for creative tasks (higher complexity needs more creativity)
    if (['creative_writing', 'brainstorming'].includes(taskType)) {
      adjustments.low = 0.05;
      adjustments.high = -0.05;
    }

    return {
      factor: 'complexity',
      adjustment: adjustments[complexity],
      reason: `${complexity} complexity adjustment`
    };
  }

  /**
   * Get user preference adjustment
   */
  private getUserPreferenceAdjustment(
    userPreference: number,
    profile: TemperatureProfile
  ): { adjustment: number } {
    // Clamp to profile bounds
    return {
      adjustment: Math.max(
        profile.minTemp,
        Math.min(profile.maxTemp, userPreference)
      )
    };
  }

  /**
   * Get retry adjustment (increase temperature for variety)
   */
  private getRetryAdjustment(attempts: number): TemperatureAdjustment {
    const adjustment = Math.min(0.1, attempts * 0.02); // +0.02 per retry, max +0.1
    return {
      factor: 'retry',
      adjustment,
      reason: `Retry attempt #${attempts} - increasing variety`
    };
  }

  /**
   * Get quality vs speed adjustment
   */
  private getQualityAdjustment(
    requirement: 'speed' | 'balanced' | 'quality',
    taskType: string
  ): TemperatureAdjustment {
    const adjustments = {
      speed: -0.05,    // Lower temp for faster, more deterministic output
      balanced: 0,
      quality: 0.05    // Higher temp for more considered output
    };

    // Inverse for factual tasks
    if (['factual_qa', 'code_generation', 'translation'].includes(taskType)) {
      adjustments.speed = 0;
      adjustments.quality = -0.05; // Lower temp for higher quality in factual tasks
    }

    return {
      factor: 'quality_requirement',
      adjustment: adjustments[requirement],
      reason: `Optimizing for ${requirement}`
    };
  }

  /**
   * Get learned temperature from historical performance
   */
  private async getLearnedTemperature(taskType: string): Promise<number | null> {
    const metrics = this.taskMetrics.get(taskType);
    
    if (!metrics || metrics.successCount < 10) {
      return null; // Not enough data
    }

    return metrics.optimalTemp;
  }

  /**
   * Calculate complementary parameters based on temperature
   */
  private calculateComplementaryParams(
    temperature: number,
    taskType: string
  ): GenerationParams {
    const params: GenerationParams = { temperature };

    // Top-p (nucleus sampling) - inverse relationship with temperature
    params.topP = 0.95 - (temperature * 0.2); // Range: 0.75-0.95

    // Top-k - task-specific
    if (['code_generation', 'factual_qa'].includes(taskType)) {
      params.topK = 10; // Very restrictive for factual tasks
    } else if (['creative_writing', 'brainstorming'].includes(taskType)) {
      params.topK = 50; // More options for creative tasks
    } else {
      params.topK = 30; // Balanced
    }

    // Repetition penalty - higher for creative tasks
    if (['creative_writing', 'brainstorming'].includes(taskType)) {
      params.repetitionPenalty = 1.15;
    } else if (['code_generation'].includes(taskType)) {
      params.repetitionPenalty = 1.0; // No penalty for code (may need repetition)
    } else {
      params.repetitionPenalty = 1.1;
    }

    // Presence and frequency penalties
    if (temperature > 0.7) {
      params.presencePenalty = 0.1;
      params.frequencyPenalty = 0.1;
    }

    return params;
  }

  /**
   * Should run A/B test for this request
   */
  private shouldRunABTest(): boolean {
    return this.abTestConfigs.enabled && Math.random() < this.abTestConfigs.sampleRate;
  }

  /**
   * Get A/B test temperature variation
   */
  private getABTestVariation(
    baseTemp: number,
    profile: TemperatureProfile
  ): number {
    const variation = (Math.random() - 0.5) * 2 * this.abTestConfigs.variationRange;
    const testTemp = baseTemp + variation;
    
    // Keep within profile bounds
    return Math.max(profile.minTemp, Math.min(profile.maxTemp, testTemp));
  }

  /**
   * Record generation result for learning
   */
  public async recordResult(
    taskType: string,
    temperature: number,
    success: boolean,
    qualityScore?: number
  ): Promise<void> {
    const profileKey = this.getTemperatureProfile(taskType).taskType;
    
    let metrics = this.taskMetrics.get(profileKey);
    if (!metrics) {
      metrics = {
        taskType: profileKey,
        successCount: 0,
        failureCount: 0,
        avgQualityScore: 0.7,
        optimalTemp: this.temperatureProfiles.get(profileKey)!.defaultTemp,
        lastUpdated: new Date()
      };
      this.taskMetrics.set(profileKey, metrics);
    }

    // Update counts
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    // Update quality score with exponential moving average
    if (qualityScore !== undefined) {
      const alpha = 0.1; // Learning rate
      metrics.avgQualityScore = 
        alpha * qualityScore + (1 - alpha) * metrics.avgQualityScore;
    }

    // Update optimal temperature using gradient descent
    if (success && qualityScore !== undefined) {
      const learningRate = 0.01;
      const gradient = (qualityScore - metrics.avgQualityScore) * 
                      (temperature - metrics.optimalTemp);
      
      metrics.optimalTemp += learningRate * gradient;
      
      // Keep within bounds
      const profile = this.temperatureProfiles.get(profileKey)!;
      metrics.optimalTemp = Math.max(
        profile.minTemp,
        Math.min(profile.maxTemp, metrics.optimalTemp)
      );
    }

    metrics.lastUpdated = new Date();

    // Persist metrics
    await this.saveTaskMetrics();
  }

  /**
   * Get temperature recommendations for all task types
   */
  public getRecommendations(): Array<{
    taskType: string;
    description: string;
    recommended: number;
    range: { min: number; max: number };
    learned?: number;
    performance?: {
      successRate: number;
      avgQuality: number;
      totalGenerations: number;
    };
  }> {
    const recommendations = [];

    for (const [taskType, profile] of this.temperatureProfiles.entries()) {
      const metrics = this.taskMetrics.get(taskType);
      
      const recommendation = {
        taskType: profile.taskType,
        description: profile.description,
        recommended: profile.defaultTemp,
        range: { min: profile.minTemp, max: profile.maxTemp },
        learned: metrics?.optimalTemp,
        performance: undefined as any
      };

      if (metrics) {
        const total = metrics.successCount + metrics.failureCount;
        if (total > 0) {
          recommendation.performance = {
            successRate: metrics.successCount / total,
            avgQuality: metrics.avgQualityScore,
            totalGenerations: total
          };
        }
      }

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Load task metrics from storage
   */
  private async loadTaskMetrics(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('temperature_metrics')
        .select('*');

      if (error) {
        logger.error('Failed to load temperature metrics:', error);
        return;
      }

      if (data) {
        data.forEach(record => {
          this.taskMetrics.set(record.task_type, {
            taskType: record.task_type,
            successCount: record.success_count,
            failureCount: record.failure_count,
            avgQualityScore: record.avg_quality_score,
            optimalTemp: record.optimal_temp,
            lastUpdated: new Date(record.last_updated)
          });
        });
      }
    } catch (error) {
      logger.error('Error loading temperature metrics:', error);
    }
  }

  /**
   * Save task metrics to storage
   */
  private async saveTaskMetrics(): Promise<void> {
    try {
      const records = Array.from(this.taskMetrics.entries()).map(([_, metrics]) => ({
        task_type: metrics.taskType,
        success_count: metrics.successCount,
        failure_count: metrics.failureCount,
        avg_quality_score: metrics.avgQualityScore,
        optimal_temp: metrics.optimalTemp,
        last_updated: metrics.lastUpdated.toISOString()
      }));

      const { error } = await this.supabase.client
        .from('temperature_metrics')
        .upsert(records, { onConflict: 'task_type' });

      if (error) {
        logger.error('Failed to save temperature metrics:', error);
      }
    } catch (error) {
      logger.error('Error saving temperature metrics:', error);
    }
  }

  /**
   * Singleton instance
   */
  private static instance: TemperatureController;
  
  public static getInstance(): TemperatureController {
    if (!TemperatureController.instance) {
      TemperatureController.instance = new TemperatureController();
    }
    return TemperatureController.instance;
  }
}