/**
 * Feedback Collector Service
 * Collects and processes execution feedback for continuous AB-MCTS improvement
 */

import type { ABMCTSFeedback, PerformanceObservation } from '@/types/ab-mcts';
import { ABMCTSReward } from '@/types/ab-mcts';
import { abMCTSService } from './ab-mcts-service';
import { bayesianModelRegistry } from '@/utils/bayesian-model';
import { healthMonitor } from './health-monitor';
import { LogContext, log } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface FeedbackMetrics {
  totalFeedbacks: number;
  averageReward: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  userSatisfaction: number;
}

export interface FeedbackAggregation {
  agentName: string;
  taskType: string;
  count: number;
  metrics: FeedbackMetrics;
  trend: 'improving' | 'stable' | 'declining';
}

export interface FeedbackCollectorConfig {
  batchSize: number;
  flushInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  enableRealTimeProcessing: boolean;
  enableAggregation: boolean;
  qualityThreshold: number; // Minimum quality score (0-1)
}

/**
 * Service for collecting and processing execution feedback
 */
export class FeedbackCollectorService extends EventEmitter {
  private config: FeedbackCollectorConfig;
  private feedbackQueue: ABMCTSFeedback[] = [];
  private feedbackHistory: Map<string, ABMCTSFeedback[]> = new Map();
  private aggregations: Map<string, FeedbackAggregation> = new Map();
  private flushTimer?: NodeJS.Timeout;
  private; // TODO: Refactor nested ternary
  isProcessing = false;

  constructor(config: Partial<FeedbackCollectorConfig> = {}) {
    super();

    this.config = {
      batchSize: 50,
      flushInterval: 5000, // 5 seconds
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      enableRealTimeProcessing: true,
      enableAggregation: true,
      qualityThreshold: 0.3,
      ...config,
    };

    this.startFlushTimer();
    this.setupHealthMonitorIntegration();
  }

  /**
   * Collect feedback from execution
   */
  async collectFeedback(feedback: ABMCTSFeedback): Promise<void> {
    log.debug('📊 Collecting feedback', LogContext.AI, {
      nodeId: feedback.nodeId,
      reward: feedback.reward.value,
      userRating: feedback.userRating,
    });

    // Add to queue
    this.feedbackQueue.push(feedback);

    // Store in history
    const key = `${feedback.context.taskType}:${feedback.context.sessionId}`;
    if (!this.feedbackHistory.has(key)) {
      this.feedbackHistory.set(key, []);
    }
    this.feedbackHistory.get(key)!.push(feedback);

    // Emit event for real-time processing
    if (this.config.enableRealTimeProcessing) {
      this.emit('feedback', feedback);
    }

    // Process immediately if batch is full
    if (this.feedbackQueue.length >= this.config.batchSize) {
      await this.processBatch();
    }

    // Update aggregations
    if (this.config.enableAggregation) {
      this.updateAggregations(feedback);
    }
  }

  /**
   * Collect feedback from health monitoring
   */
  private setupHealthMonitorIntegration(): void {
    // Subscribe to health monitor events
    setInterval(async () => {
      const healthStatus = await this.getHealthMetrics();

      // Create synthetic feedback based on system health
      if (healthStatus) {
        const systemFeedback = this.createSystemHealthFeedback(healthStatus);
        if (systemFeedback) {
          await this.collectFeedback(systemFeedback);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Process batch of feedback
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.feedbackQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = this.feedbackQueue.splice(0, this.config.batchSize);

    log.info('🔄 Processing feedback batch', LogContext.AI, {
      batchSize: batch.length,
      remainingQueue: this.feedbackQueue.length,
    });

    try {
      // Process each feedback
      for (const feedback of batch) {
        await this.processSingleFeedback(feedback);
      }

      // Batch update to AB-MCTS
      await Promise.all(batch.map((feedback) => abMCTSService.processFeedback(feedback)));

      // Emit batch processed event
      this.emit('batchProcessed', {
        size: batch.length,
        averageReward: this.calculateAverageReward(batch),
        timestamp: Date.now(),
      });
    } catch (error) {
      log.error('❌ Failed to process feedback batch', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        batchSize: batch.length,
      });

      // Re-queue failed items
      this.feedbackQueue.unshift(...batch);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual feedback
   */
  private async processSingleFeedback(feedback: ABMCTSFeedback): Promise<void> {
    // Quality check
    if (feedback.reward.value < this.config.qualityThreshold && !feedback.errorOccurred) {
      log.warn('⚠️ Low quality feedback detected', LogContext.AI, {
        nodeId: feedback.nodeId,
        reward: feedback.reward.value,
        threshold: this.config.qualityThreshold,
      });
    }

    // Extract agent information from context
    const agentName = this.extractAgentName(feedback);
    if (agentName) {
      // Create performance observation
      const observation: PerformanceObservation = {
        timestamp: feedback.timestamp,
        success: feedback.reward.value > 0.5,
        executionTime: feedback.reward.metadata.executionTime,
        resourceUsage: feedback.reward.metadata.tokensUsed + feedback.reward.metadata.memoryUsed,
        reward: feedback.reward.value,
        context: feedback.context,
      };

      // Update Bayesian model
      const model = bayesianModelRegistry.getModel(agentName, feedback.context.taskType);
      model.update(observation);
    }

    // Check for anomalies
    this.detectAnomalies(feedback);
  }

  /**
   * Update aggregations with new feedback
   */
  private updateAggregations(feedback: ABMCTSFeedback): void {
    const agentName = this.extractAgentName(feedback);
    if (!agentName) return;

    const key = `${agentName}:${feedback.context.taskType}`;

    if (!this.aggregations.has(key)) {
      this.aggregations.set(key, {
        agentName,
        taskType: feedback.context.taskType,
        count: 0,
        metrics: {
          totalFeedbacks: 0,
          averageReward: 0,
          successRate: 0,
          averageExecutionTime: 0,
          errorRate: 0,
          userSatisfaction: 0,
        },
        trend: 'stable',
      });
    }

    const agg = this.aggregations.get(key)!;
    agg.count++;

    // Update metrics using exponential moving average
    const alpha = 0.1; // Smoothing factor
    agg.metrics.totalFeedbacks++;
    agg.metrics.averageReward =
      alpha * feedback.reward.value + (1 - alpha) * agg.metrics.averageReward;
    agg.metrics.successRate =
      alpha * (feedback.reward.value > 0.5 ? 1 : 0) + (1 - alpha) * agg.metrics.successRate;
    agg.metrics.averageExecutionTime = // TODO: Refactor nested ternary
      alpha * feedback.reward.metadata.executionTime +
      (1 - alpha) * agg.metrics.averageExecutionTime;
    agg.metrics.errorRate =
      alpha * (feedback.errorOccurred ? 1 : 0) + (1 - alpha) * agg.metrics.errorRate;
    agg.metrics.userSatisfaction = feedback.userRating
      ? alpha * (feedback.userRating / 5) + (1 - alpha) * agg.metrics.userSatisfaction
      : agg.metrics.userSatisfaction;

    // Update trend
    agg.trend = this.calculateTrend(key); // TODO: Refactor nested ternary
  }

  /**
   * Detect anomalies in feedback
   */
  private detectAnomalies(feedback: ABMCTSFeedback): void {
    const anomalies: string[] = [];

    // Check for extreme execution times
    if (feedback.reward.metadata.executionTime > 30000) {
      anomalies.push('Extremely high execution time');
    }

    // Check for high error rates
    if (feedback.errorOccurred && feedback.reward.value === 0) {
      anomalies.push('Complete failure detected');
    }

    // Check for resource usage spikes
    if (feedback.reward.metadata.tokensUsed > 5000) {
      anomalies.push('High token usage');
    }

    // Check for user dissatisfaction
    if (feedback.userRating && feedback.userRating <= 2) {
      anomalies.push('Low user satisfaction');
    }

    if (anomalies.length > 0) {
      log.warn('🚨 Anomalies detected in feedback', LogContext.AI, {
        nodeId: feedback.nodeId,
        anomalies,
        reward: feedback.reward.value,
      });

      this.emit('anomaly', {
        feedback,
        anomalies,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.feedbackQueue.length > 0) {
        await this.processBatch();
      }

      // Clean old feedback
      this.cleanOldFeedback();
    }, this.config.flushInterval);
  }

  /**
   * Clean old feedback from history
   */
  private cleanOldFeedback(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;

    for (const [key, feedbacks] of this.feedbackHistory) {
      const filtered = feedbacks.filter((f) => f.timestamp > cutoff);

      if (filtered.length === 0) {
        this.feedbackHistory.delete(key);
      } else if (filtered.length < feedbacks.length) {
        this.feedbackHistory.set(key, filtered);
      }
    }
  }

  /**
   * Get feedback metrics
   */
  getMetrics(): {
    queueSize: number;
    totalProcessed: number;
    aggregations: FeedbackAggregation[];
    recentFeedbacks: ABMCTSFeedback[];
  } {
    const totalProcessed = Array.from(this.feedbackHistory.values()).reduce(
      (sum, feedbacks) => sum + feedbacks.length,
      0
    );

    const recentFeedbacks = Array.from(this.feedbackHistory.values())
      .flat()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      queueSize: this.feedbackQueue.length,
      totalProcessed,
      aggregations: Array.from(this.aggregations.values()),
      recentFeedbacks,
    };
  }

  /**
   * Get aggregated metrics for specific agent/task
   */
  getAggregatedMetrics(agentName: string, taskType: string): FeedbackAggregation | null {
    return this.aggregations.get(`${agentName}:${taskType}`) || null;
  }

  /**
   * Generate feedback report
   */
  generateReport(): {
    summary: {
      totalFeedbacks: number;
      averageQuality: number;
      topPerformers: string[];
      needsImprovement: string[];
    };
    byAgent: Record<string, FeedbackMetrics>;
    byTaskType: Record<string, FeedbackMetrics>;
    recommendations: string[];
  } {
    const allFeedbacks = Array.from(this.feedbackHistory.values()).flat();

    // Calculate summary
    const totalFeedbacks = allFeedbacks.length;
    const averageQuality =
      totalFeedbacks > 0
        ? allFeedbacks.reduce((sum, f) => sum + f.reward.value, 0) / totalFeedbacks
        : 0;

    // Group by agent
    const byAgent: Record<string, FeedbackMetrics> = {};
    const byTaskType: Record<string, FeedbackMetrics> = {};

    for (const agg of this.aggregations.values()) {
      if (!byAgent[agg.agentName]) {
        byAgent[agg.agentName] = { ...agg.metrics };
      }

      if (!byTaskType[agg.taskType]) {
        byTaskType[agg.taskType] = {
          totalFeedbacks: 0,
          averageReward: 0,
          successRate: 0,
          averageExecutionTime: 0,
          errorRate: 0,
          userSatisfaction: 0,
        };
      }

      // Aggregate task type metrics
      const taskMetrics = byTaskType[agg.taskType];
      if (taskMetrics) {
        taskMetrics.totalFeedbacks += agg.metrics.totalFeedbacks;
        taskMetrics.averageReward += agg.metrics.averageReward * agg.count;
        taskMetrics.successRate += agg.metrics.successRate * agg.count;
        taskMetrics.averageExecutionTime += agg.metrics.averageExecutionTime * agg.count;
        taskMetrics.errorRate += agg.metrics.errorRate * agg.count;
        taskMetrics.userSatisfaction += agg.metrics.userSatisfaction * agg.count;
      }
    }

    // Normalize task type metrics
    for (const [taskType, metrics] of Object.entries(byTaskType)) {
      const totalCount = Array.from(this.aggregations.values())
        .filter((agg) => agg.taskType === taskType)
        .reduce((sum, agg) => sum + agg.count, 0);

      if (totalCount > 0) {
        metrics.averageReward /= totalCount;
        metrics.successRate /= totalCount;
        metrics.averageExecutionTime /= totalCount;
        metrics.errorRate /= totalCount;
        metrics.userSatisfaction /= totalCount;
      }
    }

    // Identify top performers and needs improvement
    const agentScores = Object.entries(byAgent)
      .map(([name, metrics]) => ({
        name,
        score:
          metrics.averageReward * 0.5 + metrics.successRate * 0.3 + metrics.userSatisfaction * 0.2,
      }))
      .sort((a, b) => b.score - a.score);

    const topPerformers = agentScores.slice(0, THREE).map((a) => a.name);
    const needsImprovement = agentScores.slice(-3).map((a) => a.name);

    // Generate recommendations
    const recommendations = this.generateRecommendations(byAgent, byTaskType);

    return {
      summary: {
        totalFeedbacks,
        averageQuality,
        topPerformers,
        needsImprovement,
      },
      byAgent,
      byTaskType,
      recommendations,
    };
  }

  /**
   * Helper methods
   */
  private extractAgentName(feedback: ABMCTSFeedback): string | null {
    // Try to extract from context or node metadata
    return feedback.context.taskType.split(':')[0] || null;
  }

  private calculateAverageReward(feedbacks: ABMCTSFeedback[]): number {
    if (feedbacks.length === 0) return 0;
    return feedbacks.reduce((sum, f) => sum + f.reward.value, 0) / feedbacks.length;
  }

  private calculateTrend(key: string): 'improving' | 'stable' | 'declining' {
    const feedbacks = this.feedbackHistory.get(key);
    if (!feedbacks || feedbacks.length < 10) return 'stable';

    const recent = feedbacks.slice(-5);
    const older = feedbacks.slice(-10, -5);

    const recentAvg = this.calculateAverageReward(recent);
    const olderAvg = this.calculateAverageReward(older);

    if (recentAvg > olderAvg + 0.1) return 'improving';
    if (recentAvg < olderAvg - 0.1) return 'declining';
    return 'stable';
  }

  private generateRecommendations(
    byAgent: Record<string, FeedbackMetrics>,
    byTaskType: Record<string, FeedbackMetrics>
  ): string[] {
    const recommendations: string[] = [];

    // Agent-based recommendations
    for (const [agent, metrics] of Object.entries(byAgent)) {
      if (metrics.errorRate > 0.2) {
        recommendations.push(
          `${agent} has high error rate (${(metrics.errorRate * 100).toFixed(1)}%) - investigate failures`
        );
      }
      if (metrics.averageExecutionTime > 10000) {
        recommendations.push(
          `${agent} is slow (avg ${(metrics.averageExecutionTime / 1000).toFixed(1)}s) - consider optimization`
        );
      }
      if (metrics.userSatisfaction < 0.6 && metrics.totalFeedbacks > 10) {
        recommendations.push(`${agent} has low user satisfaction - review quality`);
      }
    }

    // Task type recommendations
    for (const [taskType, metrics] of Object.entries(byTaskType)) {
      if (metrics.successRate < 0.7) {
        recommendations.push(
          `${taskType} tasks have low success rate - consider using different agents`
        );
      }
    }

    return recommendations;
  }

  private async getHealthMetrics(): Promise<any> {
    // Would integrate with actual health monitor service
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      responseTime: Math.random() * 1000,
    };
  }

  private createSystemHealthFeedback(healthStatus: unknown): ABMCTSFeedback | null {
    // Create feedback based on system health
    if (healthStatus.cpu > 80 || healthStatus.memory > 80 || healthStatus.responseTime > 5000) {
      return {
        nodeId: `system-health-${Date.now()}`,
        reward: {
          value: 0.3, // Low score for poor health
          components: {
            quality: 0.5,
            speed: healthStatus.responseTime < 5000 ? 0.7 : 0.2,
            cost: 1 - healthStatus.cpu / 100,
          },
          metadata: {
            executionTime: healthStatus.responseTime,
            tokensUsed: 0,
            memoryUsed: healthStatus.memory,
            errors: 0,
          },
        },
        errorOccurred: false,
        timestamp: Date.now(),
        context: {
          taskType: 'system-health',
          sessionId: 'system',
        },
      };
    }
    return null;
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Process remaining feedback
    this.processBatch().then(() => {
      log.info('✅ Feedback collector shutdown complete', LogContext.AI);
    });
  }
}

// Export singleton instance
export const feedbackCollector = new FeedbackCollectorService();
export default feedbackCollector;
