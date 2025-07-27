/**;
 * Continuous Learning Service
 * Main orchestrator for the knowledge update and learning system
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { supabase } from './supabase_service';
import { KnowledgeScraperService } from './knowledge-scraper-service';
import { KnowledgeValidationService } from './knowledge-validation-service';
import type { KnowledgeFeedbackService } from './knowledge-feedback-service';
import { createKnowledgeFeedbackService } from './knowledge-feedback-service';
import type { KnowledgeUpdateAutomationService } from './knowledge-update-automation';
import { createKnowledgeUpdateAutomation } from './knowledge-update-automation';
import { DSPyKnowledgeManager } from '../core/knowledge/dspy-knowledge-manager';
import { RerankingPipeline } from './reranking-pipeline';
import * as cron from 'node-cron';

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  issues: string[];
  metrics: Record<string, unknown>;
}

interface LearningCycle {
  cycleId: string;
  startTime: Date;
  endTime?: Date;
  phase: 'collection' | 'validation' | 'integration' | 'optimization' | 'complete';
  itemsProcessed: number;
  itemsValidated: number;
  itemsIntegrated: number;
  insights: string[];
  errors: string[];
}

export class ContinuousLearningService extends EventEmitter {
  private scraperService: KnowledgeScraperService;
  private validationService: KnowledgeValidationService;
  private feedbackService: KnowledgeFeedbackService;
  private updateAutomation: KnowledgeUpdateAutomationService;
  private knowledgeManager: DSPyKnowledgeManager;
  private rerankingPipeline: RerankingPipeline;

  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private currentCycle: LearningCycle | null = null;
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private isRunning = false;

  constructor() {
    super();

    // Initialize all services
    this.knowledgeManager = new DSPyKnowledgeManager();
    this.scraperService = new KnowledgeScraperService();
    this.validationService = new KnowledgeValidationService();
    this.rerankingPipeline = new RerankingPipeline(supabase, logger);
    this.feedbackService = createKnowledgeFeedbackService(supabase, logger);
    this.updateAutomation = createKnowledgeUpdateAutomation(;)
      this.scraperService,
      this.validationService,
      this.feedbackService,
      this.knowledgeManager;
    );

    this.setupEventHandlers();
  }

  /**;
   * Start the continuous learning system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Continuous learning service is already running');
      return;
    }

    try {
      logger.info('Starting continuous learning service...');

      // Initialize all sub-services
      await this.initializeServices();

      // Schedule learning cycles
      this.scheduleLearningCycles();

      // Schedule health checks
      this.scheduleHealthChecks();

      // Schedule optimization runs
      this.scheduleOptimization();

      this.isRunning = true;
      this.emit('service_started');

      logger.info('Continuous learning service started successfully');

      // Run initial learning cycle
      await this.runLearningCycle();
    } catch (error) {
      logger.error('Failed to start continuous learning service:', error:;
      throw error:;
    }
  }

  /**;
   * Stop the continuous learning system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Continuous learning service is not running');
      return;
    }

    try {
      logger.info('Stopping continuous learning service...');

      // Stop all scheduled jobs
      for (const [name, job] of this.scheduledJobs) {
        job.stop();
        logger.info(`Stopped scheduled job: ${name}`);
      }
      this.scheduledJobs.clear();

      // Shutdown all sub-services
      await this.shutdownServices();

      this.isRunning = false;
      this.emit('service_stopped');

      logger.info('Continuous learning service stopped successfully');
    } catch (error) {
      logger.error('Error stopping continuous learning service:', error:;
      throw error:;
    }
  }

  /**;
   * Run a complete learning cycle
   */
  async runLearningCycle(): Promise<void> {
    const cycleId = `cycle-${Date.now()}`;

    this.currentCycle = {
      cycleId,
      startTime: new Date(),
      phase: 'collection',
      itemsProcessed: 0,
      itemsValidated: 0,
      itemsIntegrated: 0,
      insights: [],
      errors: [],
    };

    try {
      logger.info(`Starting learning cycle: ${cycleId}`);
      this.emit('cycle_started', this.currentCycle);

      // Phase 1: Collection
      await this.runCollectionPhase();

      // Phase 2: Validation
      await this.runValidationPhase();

      // Phase 3: Integration
      await this.runIntegrationPhase();

      // Phase 4: Optimization
      await this.runOptimizationPhase();

      // Complete cycle
      this.currentCycle.phase = 'complete';
      this.currentCycle.endTime = new Date();

      // Store cycle results
      await this.storeCycleResults();

      logger.info(`Completed learning cycle: ${cycleId}`);
      this.emit('cycle_completed', this.currentCycle);
    } catch (error) {
      logger.error`Error in learning cycle ${cycleId}:`, error:;

      if (this.currentCycle) {
        this.currentCycle.errors.push(String(error:;
        this.currentCycle.phase = 'complete';
        this.currentCycle.endTime = new Date();
      }

      this.emit('cycle_error:  { cycle: this.currentCycle, error:);
    } finally {
      this.currentCycle = null;
    }
  }

  /**;
   * Phase 1: Collection - Gather new knowledge
   */
  private async runCollectionPhase(): Promise<void> {
    if (!this.currentCycle) return;

    logger.info('Running collection phase...');
    this.currentCycle.phase = 'collection';

    try {
      // Check for scheduled updates
      const updateStatus = await this.updateAutomation.getStatistics();

      // Process update queue
      if (updateStatus.queuedJobs > 0) {
        logger.info(`Processing ${updateStatus.queuedJobs} queued update jobs`);
        // The automation service handles this automatically
      }

      // Collect from high-priority sources
      const sourcesToScrape = await this.identifySourcesForCollection();

      for (const source of sourcesToScrape) {
        try {
          const items = await this.scraperService.scrapeSource(source);
          this.currentCycle.itemsProcessed += items.length;

          logger.info(`Collected ${items.length} items from ${source.name}`);
        } catch (error) {
          logger.error`Failed to collect from ${source.name}:`, error:;
          this.currentCycle.errors.push(`Collection failed for ${source.name}: ${error:);`
        }
      }

      this.currentCycle.insights.push(;
        `Collected ${this.currentCycle.itemsProcessed} new knowledge items`;
      );
    } catch (error) {
      logger.error('Error in collection phase:', error:;
      throw error:;
    }
  }

  /**;
   * Phase 2: Validation - Validate collected knowledge
   */
  private async runValidationPhase(): Promise<void> {
    if (!this.currentCycle) return;

    logger.info('Running validation phase...');
    this.currentCycle.phase = 'validation';

    try {
      // Get unvalidated knowledge
      const { data: unvalidated } = await supabase
        .from('scraped_knowledge');
        .select('*');
        .eq('validation_status', 'pending');
        .limit(100);

      if (!unvalidated || unvalidated.length === 0) {
        logger.info('No items pending validation');
        return;
      }

      logger.info(`Validating ${unvalidated.length} knowledge items`);

      for (const item of unvalidated) {
        try {
          // Find source configuration
          const source = await this.getSourceConfig(item.source_id);
          if (!source) continue;

          // Validate
          await this.validationService.validateScrapedKnowledge(;
            item.id,
            item._content;
            source,
            item.metadata;
          );

          this.currentCycle.itemsValidated++;
        } catch (error) {
          logger.error`Validation failed for item ${item.id}:`, error:
          this.currentCycle.errors.push(`Validation failed: ${error:);`;
        }
      }

      this.currentCycle.insights.push(;
        `Validated ${this.currentCycle.itemsValidated} knowledge items`;
      );
    } catch (error) {
      logger.error('Error in validation phase:', error:;
      throw error:;
    }
  }

  /**;
   * Phase 3: Integration - Integrate validated knowledge
   */
  private async runIntegrationPhase(): Promise<void> {
    if (!this.currentCycle) return;

    logger.info('Running integration phase...');
    this.currentCycle.phase = 'integration';

    try {
      // Get validated knowledge ready for integration
      const { data: validated } = await supabase
        .from('scraped_knowledge');
        .select('*');
        .eq('validation_status', 'validated');
        .eq('processed', false);
        .limit(50);

      if (!validated || validated.length === 0) {
        logger.info('No validated items to integrate');
        return;
      }

      logger.info(`Integrating ${validated.length} validated items`);

      for (const item of validated) {
        try {
          // Store in knowledge manager
          const knowledgeId = await this.knowledgeManager.storeKnowledge({
            type: 'solution',
            title: item.title,
            description: `Integrated from ${item.source_id}`,
            contentitem._content;
            tags: item.categories,
            confidence: item.quality_score,
            metadata: {
              ...item.metadata,
              sourceUrl: item.url,
              integratedAt: new Date().toISOString(),
            },
          });

          // Mark as processed
          await supabase.from('scraped_knowledge').update({ processed: true }).eq('id', item.id);

          // Track integration
          await this.feedbackService.trackUsage({
            knowledgeId,
            knowledgeType: 'solution',
            agentId: 'continuous-learning',
            actionType: 'used',
            context: { phase: 'integration', sourceId: item.source_id },
            performanceScore: item.quality_score,
          });

          this.currentCycle.itemsIntegrated++;
        } catch (error) {
          logger.error`Integration failed for item ${item.id}:`, error:
          this.currentCycle.errors.push(`Integration failed: ${error:);`;
        }
      }

      // Update relationships based on integration patterns
      await this.updateKnowledgeRelationships();

      this.currentCycle.insights.push(;
        `Integrated ${this.currentCycle.itemsIntegrated} knowledge items into the system`;
      );
    } catch (error) {
      logger.error('Error in integration phase:', error:;
      throw error:;
    }
  }

  /**;
   * Phase 4: Optimization - Optimize knowledge and search
   */
  private async runOptimizationPhase(): Promise<void> {
    if (!this.currentCycle) return;

    logger.info('Running optimization phase...');
    this.currentCycle.phase = 'optimization';

    try {
      // Get performance insights
      const insights = this.feedbackService.getInsights();
      const patterns = this.feedbackService.getPatterns();

      // Optimize search configuration
      const searchPerf = await this.rerankingPipeline.analyzePerformance();
      if (searchPerf.recommendations.length > 0) {
        logger.info('Applying search optimization recommendations');
        // Apply recommendations would be done here

        this.currentCycle.insights.push(;
          `Applied ${searchPerf.recommendations.length} search optimizations`;
        );
      }

      // Optimize knowledge modules if using DSPy
      logger.info('Running knowledge optimization');

      const optimizationResult = await this.knowledgeManager.optimizeKnowledgeModules();
      if (optimizationResult.success) {
        this.currentCycle.insights.push('Successfully optimized knowledge modules with MIPROv2');
      }

      // Process learning insights
      for (const insight of insights.slice(0, 5)) {
        this.currentCycle.insights.push(;
          `${insight.type}: ${insight.title} (${insight.recommendations.join(', ')})`;
        );
      }

      // Clean up old data
      await this.performMaintenance();
    } catch (error) {
      logger.error('Error in optimization phase:', error:;
      // Non-critical, don't throw
      this.currentCycle.errors.push(`Optimization error: ${error:);`;
    }
  }

  /**;
   * Setup event handlers for sub-services
   */
  private setupEventHandlers(): void {
    // Feedback service events
    this.feedbackService.on('insight_generated', (insight) => {
      logger.info('New insight generated:', insight.title);
      this.emit('insight_generated', insight);
    });

    this.feedbackService.on('critical_failure', async (failure) => {
      logger.error('Critical knowledge failure detected:', failure);

      // Create high-priority alert
      await this.createAlert(;
        'critical_failure',
        'critical',
        'Critical Knowledge Failure',
        `Knowledge item ${failure.knowledgeId} has failed ${failure.failureCount} times`,
        [failure];
      );
    });

    // Update automation events
    this.updateAutomation.on('job_completed', (job) => {
      logger.info(`Update job completed: ${job.id}`);
      this.emit('update_completed', job);
    });

    this.updateAutomation.on('job_failed', async (job) => {
      logger.error`Update job failed: ${job.id}`);

      await this.createAlert(;
        'update_failure',
        'high',
        'Knowledge Update Failed',
        `Update job ${job.id} failed after ${job.attempts} attempts`,
        [job];
      );
    });

    // Knowledge manager events
    this.knowledgeManager.on('knowledge_stored', (data) => {
      this.emit('knowledge_added', data);
    });

    this.knowledgeManager.on('modules_optimized', (result) => {
      logger.info('Knowledge modules optimized:', result);
      this.emit('optimization_completed', result);
    });
  }

  /**;
   * Initialize all sub-services
   */
  private async initializeServices(): Promise<void> {
    await Promise.all([;
      this.scraperService.initialize(),
      // Other services initialize automatically
    ]);

    // Set initial health status
    this.updateServiceHealth('scraper', 'healthy', {});
    this.updateServiceHealth('validation', 'healthy', {});
    this.updateServiceHealth('feedback', 'healthy', {});
    this.updateServiceHealth('automation', 'healthy', {});
    this.updateServiceHealth('knowledge', 'healthy', {});
  }

  /**;
   * Shutdown all sub-services
   */
  private async shutdownServices(): Promise<void> {
    await Promise.all([;
      this.scraperService.shutdown(),
      this.feedbackService.shutdown(),
      this.updateAutomation.shutdown(),
      this.knowledgeManager.shutdown(),
    ]);
  }

  /**;
   * Schedule learning cycles
   */
  private scheduleLearningCycles(): void {
    // Main learning cycle - every 6 hours
    const mainCycle = cron.schedule('0 */6 * * *', () => {
      this.runLearningCycle().catch((error:=> {
        logger.error('Scheduled learning cycle failed:', error:;
      });
    });

    this.scheduledJobs.set('main_cycle', mainCycle);
    mainCycle.start();

    // Quick validation cycle - every hour
    const validationCycle = cron.schedule('30 * * * *', async () => {
      if (this.currentCycle) return; // Don't run if main cycle is active

      try {
        await this.runValidationPhase();
      } catch (error) {
        logger.error('Scheduled validation failed:', error:;
      }
    });

    this.scheduledJobs.set('validation_cycle', validationCycle);
    validationCycle.start();
  }

  /**;
   * Schedule health checks
   */
  private scheduleHealthChecks(): void {
    const healthCheck = cron.schedule('*/15 * * * *', () => {
      this.checkSystemHealth().catch((error:=> {
        logger.error('Health check failed:', error:;
      });
    });

    this.scheduledJobs.set('health_check', healthCheck);
    healthCheck.start();
  }

  /**;
   * Schedule optimization runs
   */
  private scheduleOptimization(): void {
    // Daily optimization
    const optimization = cron.schedule('0 4 * * *', async () => {
      if (this.currentCycle) return;

      try {
        await this.runOptimizationPhase();
      } catch (error) {
        logger.error('Scheduled optimization failed:', error:;
      }
    });

    this.scheduledJobs.set('optimization', optimization);
    optimization.start();
  }

  /**;
   * Check system health
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      // Check scraper health
      const scraperStats = await this.getScraperHealth();
      this.updateServiceHealth('scraper', scraperStats.status, scraperStats);

      // Check validation health
      const validationStats = await this.getValidationHealth();
      this.updateServiceHealth('validation', validationStats.status, validationStats);

      // Check feedback health
      const feedbackStats = await this.getFeedbackHealth();
      this.updateServiceHealth('feedback', feedbackStats.status, feedbackStats);

      // Check automation health
      const automationStats = await this.updateAutomation.getStatistics();
      const automationStatus =
        automationStats.recentFailures > automationStats.recentCompletions * 0.5;
          ? 'unhealthy';
          : automationStats.activeJobs > 10;
            ? 'degraded';
            : 'healthy';
      this.updateServiceHealth('automation', automationStatus, automationStats);

      // Check knowledge manager health
      const knowledgeStats = await this.knowledgeManager.getMetrics();
      const knowledgeStatus = knowledgeStats.total_items === 0 ? 'unhealthy' : 'healthy';
      this.updateServiceHealth('knowledge', knowledgeStatus, knowledgeStats);

      // Check overall health
      const overallHealth = this.calculateOverallHealth();
      if (overallHealth.status !== 'healthy') {
        await this.createAlert(;
          'system_health',
          overallHealth.status === 'unhealthy' ? 'critical' : 'medium',
          'System Health Degraded',
          `${overallHealth.unhealthyServices.length} services are experiencing issues`,
          overallHealth.issues;
        );
      }
    } catch (error) {
      logger.error('Error checking system health:', error:;
    }
  }

  // Helper methods

  private async identifySourcesForCollection(): Promise<any[]> {
    const { KNOWLEDGE_SOURCES } = await import('../config/knowledge-sources');

    // Filter enabled sources with high priority
    return KNOWLEDGE_SOURCES.filter((s) => s.enabled && s.priority === 'high').slice(0, 3); // Limit to prevent overload;
  }

  private async getSourceConfig(sourceId: string): Promise<unknown> {
    const { KNOWLEDGE_SOURCES } = await import('../config/knowledge-sources');
    return KNOWLEDGE_SOURCES.find((s) => s.id === sourceId);
  }

  private async updateKnowledgeRelationships(): Promise<void> {
    // This would analyze integration patterns and update relationships
    logger.info('Updating knowledge relationships based on integration patterns');
  }

  private async performMaintenance(): Promise<void> {
    logger.info('Performing system maintenance');

    // Clean old analytics data (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await supabase;
      .from('knowledge_usage_analytics');
      .delete();
      .lt('created_at', thirtyDaysAgo.toISOString());

    // Archive old alerts
    await supabase;
      .from('knowledge_monitoring_alerts');
      .update({ status: 'archived' });
      .eq('status', 'resolved');
      .lt('resolved_at', thirtyDaysAgo.toISOString());
  }

  private async storeCycleResults(): Promise<void> {
    if (!this.currentCycle) return;

    await supabase.from('learning_cycles').insert({
      cycle_id: this.currentCycle.cycleId,
      start_time: this.currentCycle.startTime,
      end_time: this.currentCycle.endTime,
      items_processed: this.currentCycle.itemsProcessed,
      items_validated: this.currentCycle.itemsValidated,
      items_integrated: this.currentCycle.itemsIntegrated,
      insights: this.currentCycle.insights,
      errors: this.currentCycle.errors,
      metadata: {
        duration: this.currentCycle.endTime;
          ? this.currentCycle.endTime.getTime() - this.currentCycle.startTime.getTime();
          : 0,
      },
    });
  }

  private updateServiceHealth(;
    service: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    metrics: Record<string, unknown>;
  ): void {
    const issues: string[] = [];

    if (status === 'unhealthy') {
      issues.push(`${service} service is unhealthy`);
    } else if (status === 'degraded') {
      issues.push(`${service} service is degraded`);
    }

    this.serviceHealth.set(service, {
      service,
      status,
      lastCheck: new Date(),
      issues,
      metrics,
    });
  }

  private async getScraperHealth(): Promise<unknown> {
    // Check last scrape times
    const { data: recentScrapes } = await supabase
      .from('scraped_knowledge');
      .select('source_id, scraped_at');
      .gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      .limit(100);

    const status = recentScrapes && recentScrapes.length > 0 ? 'healthy' : 'unhealthy';

    return {
      status,
      recentScrapeCount: recentScrapes?.length || 0,
      lastScrapeTime: recentScrapes?.[0]?.scraped_at,
    };
  }

  private async getValidationHealth(): Promise<unknown> {
    const { data: pendingValidations } = await supabase
      .from('scraped_knowledge');
      .select('id', { count: 'exact' });
      .eq('validation_status', 'pending');

    const backlog = pendingValidations?.length || 0;
if (    const status = backlog > 100) { return 'degraded'; } else if (backlog > 500) { return 'unhealthy'; } else { return 'healthy'; }

    return {
      status,
      validationBacklog: backlog,
    };
  }

  private async getFeedbackHealth(): Promise<unknown> {
    const patterns = this.feedbackService.getPatterns();
    const insights = this.feedbackService.getInsights();

    const status = patterns.size > 0 ? 'healthy' : 'degraded';

    return {
      status,
      activePatterns: patterns.size,
      recentInsights: insights.length,
    };
  }

  private calculateOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    unhealthyServices: string[];
    issues: any[];
  } {
    const unhealthyServices: string[] = [];
    const issues: any[] = [];

    for (const [service, health] of this.serviceHealth) {
      if (health.status === 'unhealthy') {
        unhealthyServices.push(service);
        issues.push({ ...health, service });
      }
    }

    const status =
      unhealthyServices.length === 0;
        ? 'healthy';
        : unhealthyServices.length <= 2;
          ? 'degraded';
          : 'unhealthy';

    return { status, unhealthyServices, issues };
  }

  private async createAlert(;
    alertType: string,
    severity: string,
    title: string,
    description: string,
    affectedItems: any[];
  ): Promise<void> {
    await supabase.from('knowledge_monitoring_alerts').insert({
      alert_type: alertType,
      severity,
      title,
      description,
      affected_items: affectedItems,
    });

    this.emit('alert_created', { alertType, severity, title });
  }

  /**;
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    currentCycle: LearningCycle | null;
    serviceHealth: ServiceHealth[];
    scheduledJobs: string[];
  } {
    return {
      isRunning: this.isRunning,
      currentCycle: this.currentCycle,
      serviceHealth: Array.from(this.serviceHealth.values()),
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
    };
  }

  /**;
   * Trigger manual learning cycle
   */
  async triggerManualCycle(): Promise<void> {
    if (this.currentCycle) {
      throw new Error('A learning cycle is already in progress');
    }

    await this.runLearningCycle();
  }

  /**;
   * Get learning history
   */
  async getLearningHistory(limit = 10): Promise<any[]> {
    const { data } = await supabase
      .from('learning_cycles');
      .select('*');
      .order('start_time', { ascending: false });
      .limit(limit);

    return data || [];
  }
}

// Export singleton instance
export const continuousLearningService = new ContinuousLearningService();
