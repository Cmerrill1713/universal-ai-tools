/**
 * AB-MCTS Auto-Pilot Service
 * Fully automated decision-making using AB-MCTS without manual intervention
 * Continuously learns and improves from execution outcomes
 */

import { abMCTSOrchestrator } from './ab-mcts-orchestrator';
import { feedbackCollector } from './feedback-collector';
import { parameterAnalyticsService } from './parameter-analytics-service';
import { mlParameterOptimizer } from './ml-parameter-optimizer';
import { multiTierLLM } from './multi-tier-llm-service';
import type { ABMCTSExecutionOptions, ABMCTSFeedback, AgentContext } from '@/types/ab-mcts';
import { LogContext, log } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface AutoPilotConfig {
  enabled: boolean;
  autoLearnThreshold: number; // Minimum confidence to auto-learn (0-1)
  batchSize: number; // Number of requests to process in parallel
  learningInterval: number; // How often to trigger learning (ms)
  performanceThreshold: number; // Minimum performance to continue (0-1)
  fallbackAfterFailures: number; // Number of failures before fallback
  autoOptimizeParameters: boolean;
  monitoringEnabled: boolean;
}

export interface AutoPilotMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  averageConfidence: number;
  learningCycles: number;
  parameterOptimizations: number;
}

export interface AutoPilotTask {
  id: string;
  userRequest: string;
  context: Record<string, any>;
  priority: number;
  timestamp: number;
  retries: number;
}

/**
 * Automated AB-MCTS pilot that handles requests without manual intervention
 */
export class ABMCTSAutoPilot extends EventEmitter {
  private config: AutoPilotConfig;
  private orchestrator: typeof abMCTSOrchestrator;
  private; // TODO: Refactor nested ternary
  isRunning = false;
  private taskQueue: AutoPilotTask[] = [];
  private processingTasks: Map<string, AutoPilotTask> = new Map();
  private metrics: AutoPilotMetrics;
  private learningTimer: NodeJS.Timer | null = null;
  private recentResults: Map<string, any> = new Map();

  constructor(config: Partial<AutoPilotConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      autoLearnThreshold: 0.7,
      batchSize: 5,
      learningInterval: 300000, // 5 minutes
      performanceThreshold: 0.6,
      fallbackAfterFailures: 3,
      autoOptimizeParameters: true,
      monitoringEnabled: true,
      ...config,
    };

    this.orchestrator = abMCTSOrchestrator;

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      averageConfidence: 0,
      learningCycles: 0,
      parameterOptimizations: 0,
    };
  }

  /**
   * Start the auto-pilot service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('🤖 AB-MCTS Auto-Pilot already running', LogContext.AI);
      return;
    }

    log.info('🚀 Starting AB-MCTS Auto-Pilot', LogContext.AI, {
      config: this.config,
    });

    this.isRunning = true;
    this.emit('started');

    // Start processing loop
    this.processLoop();

    // Start learning cycle
    if (this.config.autoLearnThreshold > 0) {
      this.learningTimer = setInterval(() => {
        this.performLearningCycle();
      }, this.config.learningInterval);
    }

    // Start monitoring
    if (this.config.monitoringEnabled) {
      this.startMonitoring();
    }
  }

  /**
   * Stop the auto-pilot service
   */
  async stop(): Promise<void> {
    log.info('🛑 Stopping AB-MCTS Auto-Pilot', LogContext.AI);

    this.isRunning = false;

    if (this.learningTimer) {
      clearInterval(this.learningTimer);
      this.learningTimer = null;
    }

    // Wait for current tasks to complete
    await this.waitForTaskCompletion();

    this.emit('stopped');
  }

  /**
   * Submit a task for automated processing
   */
  async submitTask(
    userRequest: string,
    context: Record<string, any> = {},
    priority = 5
  ): Promise<string> {
    const taskId = uuidv4();

    const task: AutoPilotTask = {
      id: taskId,
      userRequest,
      context,
      priority,
      timestamp: Date.now(),
      retries: 0,
    };

    // Add to queue based on priority
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    log.info('📥 Task submitted to Auto-Pilot', LogContext.AI, {
      taskId,
      queueLength: this.taskQueue.length,
    });

    this.emit('taskSubmitted', task);

    return taskId;
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get batch of tasks
        const batch = this.getBatch();

        if (batch.length > 0) {
          await this.processBatch(batch);
        } else {
          // No tasks, wait a bit
          await this.sleep(100);
        }
      } catch (error) {
        log.error('❌ Error in Auto-Pilot process loop', LogContext.AI, { error });
        await this.sleep(1000);
      }
    }
  }

  /**
   * Process a batch of tasks
   */
  private async processBatch(batch: AutoPilotTask[]): Promise<void> {
    const startTime = Date.now();

    log.info('🔄 Processing batch', LogContext.AI, {
      batchSize: batch.length,
      taskIds: batch.map((t) => t.id),
    });

    // Process tasks in parallel
    const results = await Promise.allSettled(batch.map((task) => this.processTask(task)));

    // Update metrics
    const processingTime = Date.now() - startTime;
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.updateMetrics({
      totalRequests: batch.length,
      successfulRequests: successful,
      failedRequests: failed,
      processingTime,
    });

    // Handle failed tasks
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        await this.handleFailedTask(batch[i]);
      }
    }
  }

  /**
   * Process a single task
   */
  private async processTask(task: AutoPilotTask): Promise<any> {
    this.processingTasks.set(task.id, task);

    try {
      // Create agent context
      const agentContext: AgentContext = {
        userRequest: task.userRequest,
        requestId: task.id,
        userId: 'auto-pilot',
        metadata: {
          ...task.context,
          autoPilot: true,
          priority: task.priority,
          attempt: task.retries + 1,
        },
      };

      // Configure execution options for automation
      const options: ABMCTSExecutionOptions = {
        useCache: true,
        enableParallelism: true,
        collectFeedback: true,
        saveCheckpoints: false,
        visualize: false,
        verboseLogging: false,
        fallbackStrategy: 'greedy',
      };

      // Execute with AB-MCTS
      const result = await this.orchestrator.orchestrate(agentContext, options);

      // Store result for learning
      this.recentResults.set(task.id, {
        task,
        result,
        timestamp: Date.now(),
      });

      // Auto-generate feedback based on execution metrics
      await this.generateAutoFeedback(task, result);

      this.emit('taskCompleted', {
        taskId: task.id,
        result,
        processingTime: Date.now() - task.timestamp,
      });

      return result;
    } finally {
      this.processingTasks.delete(task.id);
    }
  }

  /**
   * Generate automatic feedback based on execution metrics
   */
  private async generateAutoFeedback(task: AutoPilotTask, result: unknown): Promise<void> {
    // Calculate performance score based on various factors
    const responseTime = result.totalTime || 0;
    const tokensUsed = result.resourcesUsed?.tokensUsed || 0;
    const agentsUsed = result.resourcesUsed?.agents || 0;

    // Performance scoring (0-1)
    const timeScore = Math.max(0, 1 - responseTime / 10000); // Faster is better
    const efficiencyScore = Math.max(0, 1 - tokensUsed / 5000); // Fewer tokens is better
    const simplicityScore = Math.max(0, 1 - agentsUsed / 10); // Fewer agents is better

    const overallScore = (timeScore + efficiencyScore + simplicityScore) / THREE;

    // Only learn from high-confidence results
    if (overallScore >= this.config.autoLearnThreshold) {
      const feedback: ABMCTSFeedback = {
        orchestrationId: result.searchResult?.searchId || task.id,
        score: overallScore,
        reward: {
          value: overallScore,
          components: {
            time: timeScore,
            efficiency: efficiencyScore,
            simplicity: simplicityScore,
          },
        },
        metadata: {
          automated: true,
          taskId: task.id,
          responseTime,
          tokensUsed,
          agentsUsed,
        },
      };

      await feedbackCollector.collectFeedback('ab-mcts', task.id, 'auto-pilot', feedback);

      log.info('📊 Auto-feedback generated', LogContext.AI, {
        taskId: task.id,
        score: overallScore,
        learned: true,
      });
    }
  }

  /**
   * Perform periodic learning cycle
   */
  private async performLearningCycle(): Promise<void> {
    try {
      log.info('🧠 Starting learning cycle', LogContext.AI);
      this.metrics.learningCycles++;

      // Get recent feedback data
      const // TODO: Refactor nested ternary
        recentFeedback = await feedbackCollector.getRecentFeedback('ab-mcts', 100);

      if (recentFeedback.length < 10) {
        log.info('⏸️ Not enough data for learning', LogContext.AI);
        return;
      }

      // Analyze performance trends
      const performanceAnalysis = this.analyzePerformance(recentFeedback);

      // Optimize parameters if enabled
      if (this.config.autoOptimizeParameters && performanceAnalysis.averageScore < 0.8) {
        await this.optimizeParameters(performanceAnalysis);
      }

      // Emit learning complete event
      this.emit('learningComplete', {
        cycleNumber: this.metrics.learningCycles,
        performanceAnalysis,
        optimized: this.config.autoOptimizeParameters,
      });
    } catch (error) {
      log.error('❌ Learning cycle failed', LogContext.AI, { error });
    }
  }

  /**
   * Analyze performance from feedback
   */
  private analyzePerformance(feedback: unknown[]): unknown {
    const scores = feedback.map((f) => f.score || f.reward?.value || 0);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const times = feedback.map((f) => f.metadata?.responseTime || 0).filter((t) => t > 0);
    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

    return {
      averageScore,
      averageTime,
      totalFeedback: feedback.length,
      scoreDistribution: this.calculateDistribution(scores),
      trends: this.calculateTrends(feedback),
    };
  }

  /**
   * Optimize parameters based on performance
   */
  private async optimizeParameters(analysis: unknown): Promise<void> {
    try {
      log.info('🔧 Optimizing parameters', LogContext.AI, { analysis });

      // Use ML parameter optimizer to improve
      const recommendations = await mlParameterOptimizer.getOptimizationInsights();

      // Apply top recommendations
      for (const recommendation of recommendations.slice(0, THREE)) {
        await parameterAnalyticsService.applyRecommendation(recommendation);
      }

      this.metrics.parameterOptimizations++;

      log.info('✅ Parameters optimized', LogContext.AI, {
        appliedRecommendations: recommendations.length,
      });
    } catch (error) {
      log.error('❌ Parameter optimization failed', LogContext.AI, { error });
    }
  }

  /**
   * Handle failed tasks
   */
  private async handleFailedTask(task: AutoPilotTask): Promise<void> {
    task.retries++;

    if (task.retries < this.config.fallbackAfterFailures) {
      // Retry with lower priority
      task.priority = Math.max(1, task.priority - 1);
      this.taskQueue.push(task);

      log.info('🔄 Retrying failed task', LogContext.AI, {
        taskId: task.id,
        retries: task.retries,
      });
    } else {
      // Max retries reached, use fallback
      await this.executeFallback(task);
    }
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback(task: AutoPilotTask): Promise<void> {
    try {
      log.warn('⚠️ Executing fallback for task', LogContext.AI, {
        taskId: task.id,
        retries: task.retries,
      });

      // Use multi-tier LLM directly as fallback
      const result = await multiTierLLM.process(task.userRequest, task.context);

      this.emit('taskFallback', {
        taskId: task.id,
        result,
        reason: 'max_retries_exceeded',
      });
    } catch (error) {
      log.error('❌ Fallback execution failed', LogContext.AI, {
        taskId: task.id,
        error,
      });

      this.emit('taskFailed', {
        taskId: task.id,
        error,
        retries: task.retries,
      });
    }
  }

  /**
   * Get batch of tasks from queue
   */
  private getBatch(): AutoPilotTask[] {
    const availableSlots = this.config.batchSize - this.processingTasks.size;

    if (availableSlots <= 0) {
      return [];
    }

    return this.taskQueue.splice(0, availableSlots);
  }

  /**
   * Start monitoring
   */
  private startMonitoring(): void {
    setInterval(() => {
      this.emit('metrics', this.getMetrics());
    }, 30000); // Every 30 seconds
  }

  /**
   * Update metrics
   */
  private updateMetrics(update: unknown): void {
    this.metrics.totalRequests += update.totalRequests || 0;
    this.metrics.successfulRequests += update.successfulRequests || 0;
    this.metrics.failedRequests += update.failedRequests || 0;

    // Update moving averages
    const alpha = 0.1;
    if (update.processingTime) {
      this.metrics.averageResponseTime =
        alpha * update.processingTime + (1 - alpha) * this.metrics.averageResponseTime;
    }
  }

  /**
   * Calculate distribution of scores
   */
  private calculateDistribution(scores: number[]): unknown {
    const sorted = scores.sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / TWO)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
    };
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(feedback: unknown[]): unknown {
    // Sort by timestamp
    const sorted = feedback.sort(
      (a, b) => (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0)
    );

    // Calculate trend over time
    const recentAvg = (sorted as any).slice(-10).reduce((a, b) => a + (b.score || 0), 0) / 10;
    const olderAvg = (sorted as any).slice(0, 10).reduce((a, b) => a + (b.score || 0), 0) / 10;

    return {
      improving: recentAvg > olderAvg,
      recentAverage: recentAvg,
      historicalAverage: olderAvg,
      trend: ((recentAvg - olderAvg) / olderAvg) * 100,
    };
  }

  /**
   * Wait for all tasks to complete
   */
  private async waitForTaskCompletion(): Promise<void> {
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.processingTasks.size > 0 && Date.now() - startTime < maxWait) {
      await this.sleep(100);
    }

    if (this.processingTasks.size > 0) {
      log.warn('⚠️ Some tasks still processing after timeout', LogContext.AI, {
        remaining: this.processingTasks.size,
      });
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current metrics
   */
  getMetrics(): AutoPilotMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): unknown {
    return {
      queued: this.taskQueue.length,
      processing: this.processingTasks.size,
      queuedTasks: this.taskQueue.map((t) => ({
        id: t.id,
        priority: t.priority,
        age: Date.now() - t.timestamp,
      })),
      processingTasks: Array.from(this.processingTasks.values()).map((t) => ({
        id: t.id,
        priority: t.priority,
        duration: Date.now() - t.timestamp,
      })),
    };
  }

  /**
   * Check if auto-pilot is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const abMCTSAutoPilot = new ABMCTSAutoPilot();
export default abMCTSAutoPilot;
